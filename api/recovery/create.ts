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

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Thiếu Authorization Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    // 1. Xác thực user từ token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Phiên làm việc không hợp lệ hoặc đã hết hạn.' });
    }

    // 2. Tạo mã ngẫu nhiên an toàn (16 ký tự phân tách cụm)
    const rawBytes = crypto.randomBytes(12);
    const codeSegment = rawBytes.toString('hex').toUpperCase();
    const formattedCode = `GMTU-${codeSegment.slice(0, 4)}-${codeSegment.slice(4, 8)}-${codeSegment.slice(8, 12)}-${codeSegment.slice(12, 16)}`;

    // 3. Tính băm SHA-256
    const hash = crypto.createHash('sha256').update(formattedCode.trim()).digest('hex');

    // 4. Thu hồi các mã cũ của profile này
    await supabase
      .from('recovery_codes')
      .update({ revoked: true })
      .eq('profile_id', user.id)
      .eq('revoked', false);

    // 5. Lưu bản băm vào database (không bao giờ lưu mã rõ)
    const { error: insertError } = await supabase.from('recovery_codes').insert({
      profile_id: user.id,
      code_hash: hash,
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      revoked: false,
      attempts: 0,
    });

    if (insertError) {
      return res.status(500).json({ error: 'Lỗi khi lưu mã khôi phục: ' + insertError.message });
    }

    // 6. Trả về mã rõ cho người dùng MỘT LẦN DUY NHẤT
    return res.status(200).json({
      success: true,
      code: formattedCode,
      message: 'Ai có mã này có thể truy cập tiến trình và lời chúc của bạn. Hãy giữ mã riêng tư.',
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message || 'Lỗi xử lý server.' });
  }
}

