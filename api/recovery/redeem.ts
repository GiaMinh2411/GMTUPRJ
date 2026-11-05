import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Chưa cấu hình Supabase Server Environment Variables.' });
  }

  const { code } = req.body || {};
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Vui lòng cung cấp mã khôi phục.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Thiếu Authorization Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    // 1. Xác thực user hiện tại trên thiết bị mới
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Phiên làm việc thiết bị hiện tại không hợp lệ.' });
    }

    // 2. Tính SHA-256 hash của mã người dùng nhập
    const hash = crypto.createHash('sha256').update(code.trim()).digest('hex');

    // 3. Gọi hàm fn_redeem_recovery_code hoặc truy vấn mã
    const { data: rec, error: recError } = await supabase
      .from('recovery_codes')
      .select('*')
      .eq('code_hash', hash)
      .maybeSingle();

    if (recError || !rec) {
      return res.status(404).json({ error: 'Mã khôi phục không tồn tại hoặc không chính xác.' });
    }

    if (rec.revoked) {
      return res.status(400).json({ error: 'Mã khôi phục này đã được sử dụng hoặc đã bị thu hồi.' });
    }

    if (new Date(rec.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Mã khôi phục đã hết hạn sử dụng (quá 90 ngày).' });
    }

    if (rec.attempts >= 5) {
      await supabase.from('recovery_codes').update({ revoked: true }).eq('id', rec.id);
      return res.status(400).json({ error: 'Mã đã bị khóa do thử sai quá 5 lần.' });
    }

    // 4. Lấy dữ liệu hồ sơ liên kết
    const sourceProfileId = rec.profile_id;
    const [profileRes, appRes, progRes, rosRes, statsRes, setRes, wishRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', sourceProfileId).single(),
      supabase.from('appearances').select('*').eq('profile_id', sourceProfileId).maybeSingle(),
      supabase.from('player_progress').select('*').eq('profile_id', sourceProfileId).maybeSingle(),
      supabase.from('rosary_progress').select('*').eq('profile_id', sourceProfileId).maybeSingle(),
      supabase.from('player_stats').select('*').eq('profile_id', sourceProfileId).maybeSingle(),
      supabase.from('player_settings').select('*').eq('profile_id', sourceProfileId).maybeSingle(),
      supabase.from('wishes').select('content, created_at').eq('profile_id', sourceProfileId).eq('is_deleted', false),
    ]);

    if (!profileRes.data) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ người chơi tương ứng với mã.' });
    }

    // 5. Thu hồi mã đã sử dụng
    await supabase.from('recovery_codes').update({ revoked: true }).eq('id', rec.id);

    // 6. Trả về toàn bộ dữ liệu hồ sơ đã được server xác thực
    const p = profileRes.data;
    const app = appRes.data || {};
    const prog = progRes.data || {};
    const ros = rosRes.data || {};
    const stats = statsRes.data || {};
    const settings = setRes.data || {};
    const wishes = (wishRes.data || []).map((w) => ({ text: w.content, date: w.created_at }));

    return res.status(200).json({
      success: true,
      profile: {
        guestId: `cloud-${sourceProfileId}`,
        name: p.display_name,
        gender: p.gender,
        onboardingCompleted: p.onboarding_completed,
        color: app.color || '#b59a74',
        style: app.style || 0,
        face: app.face || 'happy',
        glasses: Boolean(app.glasses),
        skinColor: app.skin_color || '#cda78c',
        hairColor: app.hair_color || '#27241f',
        outfit: app.outfit || 'lam',
        position: { x: prog.position_x || 0, z: prog.position_z || 8.5 },
        completed: prog.completed_activities || [],
        metGiaMinh: Boolean(prog.met_gia_minh),
        viewedGuides: prog.viewed_guides || [],
        beadTotal: ros.bead_total || 0,
        beadSound: Boolean(ros.bead_sound),
        haptic: Boolean(ros.haptic),
        incense: stats.incense_count || 0,
        flower: stats.flower_color || '',
        sound: settings.sound !== false,
        chantVolume: settings.chant_volume ?? 0.5,
        environmentVolume: settings.environment_volume ?? 0.2,
        effectsVolume: settings.effects_volume ?? 0.45,
        quality: settings.quality || 'medium',
        wishes,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message || 'Lỗi xử lý server.' });
  }
}

