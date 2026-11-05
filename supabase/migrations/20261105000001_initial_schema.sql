-- GM TỰ - Supabase Free Tier Schema Migration
-- Migration: 20261105000001_initial_schema.sql
-- Mô tả: Khởi tạo bảng dữ liệu người chơi, ràng buộc toàn vẹn, RLS, hàm bảo mật và quản trị.

-- 1. Bảng quản trị viên (Admin Users)
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Hàm kiểm tra quyền admin an toàn (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  );
$$;

-- 2. Bảng hồ sơ người chơi (Profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('male', 'female')),
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT chk_profile_display_name CHECK (
    length(trim(display_name)) >= 2 AND
    length(trim(display_name)) <= 30 AND
    display_name !~ '[\u0000-\u001F\u007F-\u009F\u200B-\u200D\u2060\uFEFF]'
  ),
  CONSTRAINT chk_onboarding_requires_valid_data CHECK (
    NOT onboarding_completed OR (
      length(trim(display_name)) >= 2 AND
      gender IN ('male', 'female')
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_created ON public.profiles(created_at DESC);

-- 3. Bảng tùy biến ngoại hình (Appearances)
CREATE TABLE IF NOT EXISTS public.appearances (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  gender text NOT NULL CHECK (gender IN ('male', 'female')),
  style integer NOT NULL DEFAULT 0,
  outfit text NOT NULL DEFAULT 'lam' CHECK (outfit IN ('lam', 'shirt')),
  color text NOT NULL DEFAULT '#b59a74',
  skin_color text NOT NULL DEFAULT '#cda78c',
  hair_color text NOT NULL DEFAULT '#27241f',
  face text NOT NULL DEFAULT 'happy',
  glasses boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Bảng vị trí và tiến trình khám phá (Player Progress)
CREATE TABLE IF NOT EXISTS public.player_progress (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  position_x double precision NOT NULL DEFAULT 0,
  position_z double precision NOT NULL DEFAULT 8.5,
  completed_activities text[] NOT NULL DEFAULT '{}',
  met_gia_minh boolean NOT NULL DEFAULT false,
  viewed_guides text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Bảng tiến trình tràng hạt (Rosary Progress)
CREATE TABLE IF NOT EXISTS public.rosary_progress (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  bead_total integer NOT NULL DEFAULT 0 CHECK (bead_total >= 0),
  bead_sound boolean NOT NULL DEFAULT false,
  haptic boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Bảng thống kê hoạt động (Player Stats)
CREATE TABLE IF NOT EXISTS public.player_stats (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  incense_count integer NOT NULL DEFAULT 0 CHECK (incense_count >= 0),
  flower_color text NOT NULL DEFAULT '',
  bell_count integer NOT NULL DEFAULT 0 CHECK (bell_count >= 0),
  lantern_count integer NOT NULL DEFAULT 0 CHECK (lantern_count >= 0),
  play_time_seconds integer NOT NULL DEFAULT 0 CHECK (play_time_seconds >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Bảng cài đặt người chơi (Player Settings)
CREATE TABLE IF NOT EXISTS public.player_settings (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  sound boolean NOT NULL DEFAULT true,
  chant_volume double precision NOT NULL DEFAULT 0.5 CHECK (chant_volume >= 0 AND chant_volume <= 1),
  environment_volume double precision NOT NULL DEFAULT 0.2 CHECK (environment_volume >= 0 AND environment_volume <= 1),
  effects_volume double precision NOT NULL DEFAULT 0.45 CHECK (effects_volume >= 0 AND effects_volume <= 1),
  quality text NOT NULL DEFAULT 'medium' CHECK (quality IN ('low', 'medium', 'high')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Bảng lời chúc và hoa đăng (Wishes - Riêng tư)
CREATE TABLE IF NOT EXISTS public.wishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name text NOT NULL,
  content text NOT NULL,
  flower_color text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  CONSTRAINT chk_wish_content CHECK (
    length(trim(content)) >= 1 AND
    length(trim(content)) <= 150
  )
);

CREATE INDEX IF NOT EXISTS idx_wishes_profile ON public.wishes(profile_id);
CREATE INDEX IF NOT EXISTS idx_wishes_created ON public.wishes(created_at DESC);

-- 9. Bảng phiên thiền (Meditation Sessions)
CREATE TABLE IF NOT EXISTS public.meditation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  actual_seconds integer NOT NULL DEFAULT 0 CHECK (actual_seconds >= 0),
  completed boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_meditation_profile ON public.meditation_sessions(profile_id);

-- 10. Bảng mã khôi phục (Recovery Codes - Chỉ lưu hash SHA-256)
CREATE TABLE IF NOT EXISTS public.recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  revoked boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_recovery_codes_hash ON public.recovery_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_recovery_codes_profile ON public.recovery_codes(profile_id);

-- 11. Bật Row Level Security (RLS) trên TẤT CẢ các bảng
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appearances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rosary_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meditation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_codes ENABLE ROW LEVEL SECURITY;

-- 12. Chính sách RLS (RLS Policies)

-- Admin users: chỉ admin xem được danh sách admin
CREATE POLICY admin_users_select ON public.admin_users
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Profiles: Người chơi xem/sửa hồ sơ của chính mình; Admin xem được tất cả
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated, anon
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated, anon
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE TO authenticated, anon
  USING (auth.uid() = id OR public.is_admin());

-- Appearances
CREATE POLICY appearances_select ON public.appearances
  FOR SELECT TO authenticated, anon
  USING (auth.uid() = profile_id OR public.is_admin());

CREATE POLICY appearances_insert ON public.appearances
  FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY appearances_update ON public.appearances
  FOR UPDATE TO authenticated, anon
  USING (auth.uid() = profile_id OR public.is_admin())
  WITH CHECK (auth.uid() = profile_id);

-- Player Progress
CREATE POLICY progress_select ON public.player_progress
  FOR SELECT TO authenticated, anon
  USING (auth.uid() = profile_id OR public.is_admin());

CREATE POLICY progress_insert ON public.player_progress
  FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY progress_update ON public.player_progress
  FOR UPDATE TO authenticated, anon
  USING (auth.uid() = profile_id OR public.is_admin())
  WITH CHECK (auth.uid() = profile_id);

-- Rosary Progress
CREATE POLICY rosary_select ON public.rosary_progress
  FOR SELECT TO authenticated, anon
  USING (auth.uid() = profile_id OR public.is_admin());

CREATE POLICY rosary_insert ON public.rosary_progress
  FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY rosary_update ON public.rosary_progress
  FOR UPDATE TO authenticated, anon
  USING (auth.uid() = profile_id OR public.is_admin())
  WITH CHECK (auth.uid() = profile_id);

-- Player Stats
CREATE POLICY stats_select ON public.player_stats
  FOR SELECT TO authenticated, anon
  USING (auth.uid() = profile_id OR public.is_admin());

CREATE POLICY stats_insert ON public.player_stats
  FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY stats_update ON public.player_stats
  FOR UPDATE TO authenticated, anon
  USING (auth.uid() = profile_id OR public.is_admin())
  WITH CHECK (auth.uid() = profile_id);

-- Player Settings
CREATE POLICY settings_select ON public.player_settings
  FOR SELECT TO authenticated, anon
  USING (auth.uid() = profile_id OR public.is_admin());

CREATE POLICY settings_insert ON public.player_settings
  FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY settings_update ON public.player_settings
  FOR UPDATE TO authenticated, anon
  USING (auth.uid() = profile_id OR public.is_admin())
  WITH CHECK (auth.uid() = profile_id);

-- Wishes: Người gửi chỉ xem lời chúc của mình (chưa xóa); Admin xem được tất cả
CREATE POLICY wishes_select ON public.wishes
  FOR SELECT TO authenticated, anon
  USING ((auth.uid() = profile_id AND is_deleted = false) OR public.is_admin());

CREATE POLICY wishes_insert ON public.wishes
  FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY wishes_update ON public.wishes
  FOR UPDATE TO authenticated, anon
  USING (auth.uid() = profile_id OR public.is_admin())
  WITH CHECK (auth.uid() = profile_id OR public.is_admin());

CREATE POLICY wishes_delete ON public.wishes
  FOR DELETE TO authenticated, anon
  USING (public.is_admin());

-- Meditation Sessions
CREATE POLICY meditation_select ON public.meditation_sessions
  FOR SELECT TO authenticated, anon
  USING (auth.uid() = profile_id OR public.is_admin());

CREATE POLICY meditation_insert ON public.meditation_sessions
  FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY meditation_update ON public.meditation_sessions
  FOR UPDATE TO authenticated, anon
  USING (auth.uid() = profile_id OR public.is_admin())
  WITH CHECK (auth.uid() = profile_id);

-- Recovery Codes: KHÔNG cho phép client đọc hoặc ghi trực tiếp qua REST!
-- Chỉ truy cập qua SECURITY DEFINER functions bên dưới hoặc service_role.

-- 13. Hàm lưu gộp hồ sơ nguyên tử (Atomic Upsert Bundle)
CREATE OR REPLACE FUNCTION public.sync_player_bundle(
  p_display_name text,
  p_gender text,
  p_onboarding_completed boolean,
  p_appearance jsonb,
  p_progress jsonb,
  p_rosary jsonb,
  p_stats jsonb,
  p_settings jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
  v_version integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Chưa xác thực danh tính khách.';
  END IF;

  -- Kiểm tra dữ liệu đầu vào
  IF length(trim(p_display_name)) < 2 OR length(trim(p_display_name)) > 30 THEN
    RAISE EXCEPTION 'Tên hiển thị phải từ 2 đến 30 ký tự.';
  END IF;

  IF p_gender NOT IN ('male', 'female') THEN
    RAISE EXCEPTION 'Giới tính không hợp lệ.';
  END IF;

  -- Upsert profile
  INSERT INTO public.profiles (id, display_name, gender, onboarding_completed, updated_at, last_active_at, version)
  VALUES (v_uid, trim(p_display_name), p_gender, p_onboarding_completed, now(), now(), 1)
  ON CONFLICT (id) DO UPDATE SET
    display_name = trim(p_display_name),
    gender = p_gender,
    onboarding_completed = p_onboarding_completed,
    updated_at = now(),
    last_active_at = now(),
    version = profiles.version + 1
  RETURNING version INTO v_version;

  -- Upsert appearance
  IF p_appearance IS NOT NULL THEN
    INSERT INTO public.appearances (
      profile_id, gender, style, outfit, color, skin_color, hair_color, face, glasses, updated_at
    )
    VALUES (
      v_uid,
      p_gender,
      COALESCE((p_appearance->>'style')::integer, 0),
      COALESCE(p_appearance->>'outfit', 'lam'),
      COALESCE(p_appearance->>'color', '#b59a74'),
      COALESCE(p_appearance->>'skinColor', '#cda78c'),
      COALESCE(p_appearance->>'hairColor', '#27241f'),
      COALESCE(p_appearance->>'face', 'happy'),
      COALESCE((p_appearance->>'glasses')::boolean, false),
      now()
    )
    ON CONFLICT (profile_id) DO UPDATE SET
      gender = p_gender,
      style = EXCLUDED.style,
      outfit = EXCLUDED.outfit,
      color = EXCLUDED.color,
      skin_color = EXCLUDED.skin_color,
      hair_color = EXCLUDED.hair_color,
      face = EXCLUDED.face,
      glasses = EXCLUDED.glasses,
      updated_at = now();
  END IF;

  -- Upsert progress
  IF p_progress IS NOT NULL THEN
    INSERT INTO public.player_progress (
      profile_id, position_x, position_z, completed_activities, met_gia_minh, viewed_guides, updated_at
    )
    VALUES (
      v_uid,
      COALESCE((p_progress->>'x')::double precision, 0),
      COALESCE((p_progress->>'z')::double precision, 8.5),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_progress->'completed', '[]'::jsonb))),
      COALESCE((p_progress->>'metGiaMinh')::boolean, false),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_progress->'viewedGuides', '[]'::jsonb))),
      now()
    )
    ON CONFLICT (profile_id) DO UPDATE SET
      position_x = EXCLUDED.position_x,
      position_z = EXCLUDED.position_z,
      completed_activities = EXCLUDED.completed_activities,
      met_gia_minh = EXCLUDED.met_gia_minh,
      viewed_guides = EXCLUDED.viewed_guides,
      updated_at = now();
  END IF;

  -- Upsert rosary
  IF p_rosary IS NOT NULL THEN
    INSERT INTO public.rosary_progress (
      profile_id, bead_total, bead_sound, haptic, updated_at
    )
    VALUES (
      v_uid,
      GREATEST(0, COALESCE((p_rosary->>'beadTotal')::integer, 0)),
      COALESCE((p_rosary->>'beadSound')::boolean, false),
      COALESCE((p_rosary->>'haptic')::boolean, false),
      now()
    )
    ON CONFLICT (profile_id) DO UPDATE SET
      bead_total = EXCLUDED.bead_total,
      bead_sound = EXCLUDED.bead_sound,
      haptic = EXCLUDED.haptic,
      updated_at = now();
  END IF;

  -- Upsert stats
  IF p_stats IS NOT NULL THEN
    INSERT INTO public.player_stats (
      profile_id, incense_count, flower_color, bell_count, lantern_count, play_time_seconds, updated_at
    )
    VALUES (
      v_uid,
      GREATEST(0, COALESCE((p_stats->>'incense')::integer, 0)),
      COALESCE(p_stats->>'flower', ''),
      GREATEST(0, COALESCE((p_stats->>'bell')::integer, 0)),
      GREATEST(0, COALESCE((p_stats->>'lantern')::integer, 0)),
      GREATEST(0, COALESCE((p_stats->>'playTime')::integer, 0)),
      now()
    )
    ON CONFLICT (profile_id) DO UPDATE SET
      incense_count = EXCLUDED.incense_count,
      flower_color = EXCLUDED.flower_color,
      bell_count = EXCLUDED.bell_count,
      lantern_count = EXCLUDED.lantern_count,
      play_time_seconds = EXCLUDED.play_time_seconds,
      updated_at = now();
  END IF;

  -- Upsert settings
  IF p_settings IS NOT NULL THEN
    INSERT INTO public.player_settings (
      profile_id, sound, chant_volume, environment_volume, effects_volume, quality, updated_at
    )
    VALUES (
      v_uid,
      COALESCE((p_settings->>'sound')::boolean, true),
      LEAST(1.0, GREATEST(0.0, COALESCE((p_settings->>'chantVolume')::double precision, 0.5))),
      LEAST(1.0, GREATEST(0.0, COALESCE((p_settings->>'environmentVolume')::double precision, 0.2))),
      LEAST(1.0, GREATEST(0.0, COALESCE((p_settings->>'effectsVolume')::double precision, 0.45))),
      COALESCE(p_settings->>'quality', 'medium'),
      now()
    )
    ON CONFLICT (profile_id) DO UPDATE SET
      sound = EXCLUDED.sound,
      chant_volume = EXCLUDED.chant_volume,
      environment_volume = EXCLUDED.environment_volume,
      effects_volume = EXCLUDED.effects_volume,
      quality = EXCLUDED.quality,
      updated_at = now();
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'profile_id', v_uid,
    'version', v_version,
    'updated_at', now()
  );

  RETURN v_result;
END;
$$;

-- 14. Hàm tạo và đăng ký mã khôi phục (Store Recovery Code Hash)
CREATE OR REPLACE FUNCTION public.fn_register_recovery_code(
  p_code_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Chưa xác thực danh tính khách.';
  END IF;

  -- Giới hạn tần suất tạo mã: tối đa 5 mã hoạt động, thu hồi mã cũ
  UPDATE public.recovery_codes
  SET revoked = true
  WHERE profile_id = v_uid AND revoked = false;

  -- Lưu hash mới
  INSERT INTO public.recovery_codes (profile_id, code_hash, created_at, expires_at, revoked, attempts)
  VALUES (v_uid, p_code_hash, now(), now() + interval '90 days', false, 0);

  RETURN jsonb_build_object('success', true, 'message', 'Đã đăng ký mã khôi phục an toàn.');
END;
$$;

-- 15. Hàm đổi mã khôi phục (Redeem Recovery Code)
CREATE OR REPLACE FUNCTION public.fn_redeem_recovery_code(
  p_code_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_curr_uid uuid := auth.uid();
  v_rec record;
  v_profile record;
  v_appearance record;
  v_progress record;
  v_rosary record;
  v_stats record;
  v_settings record;
  v_wishes jsonb;
BEGIN
  IF v_curr_uid IS NULL THEN
    RAISE EXCEPTION 'Chưa xác thực phiên hiện tại.';
  END IF;

  -- Tìm mã theo hash
  SELECT * INTO v_rec FROM public.recovery_codes
  WHERE code_hash = p_code_hash;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mã khôi phục không tồn tại hoặc sai cú pháp.';
  END IF;

  -- Kiểm tra số lần thử sai để chống brute-force
  IF v_rec.attempts >= 5 THEN
    UPDATE public.recovery_codes SET revoked = true WHERE id = v_rec.id;
    RAISE EXCEPTION 'Mã khôi phục đã bị khóa do thử sai quá 5 lần.';
  END IF;

  IF v_rec.revoked = true THEN
    RAISE EXCEPTION 'Mã khôi phục này đã bị thu hồi hoặc đã được sử dụng.';
  END IF;

  IF v_rec.expires_at < now() THEN
    RAISE EXCEPTION 'Mã khôi phục đã hết hạn sử dụng (quá 90 ngày).';
  END IF;

  -- Lấy toàn bộ dữ liệu nguồn từ profile gốc
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_rec.profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ liên kết với mã này.';
  END IF;

  SELECT * INTO v_appearance FROM public.appearances WHERE profile_id = v_rec.profile_id;
  SELECT * INTO v_progress FROM public.player_progress WHERE profile_id = v_rec.profile_id;
  SELECT * INTO v_rosary FROM public.rosary_progress WHERE profile_id = v_rec.profile_id;
  SELECT * INTO v_stats FROM public.player_stats WHERE profile_id = v_rec.profile_id;
  SELECT * INTO v_settings FROM public.player_settings WHERE profile_id = v_rec.profile_id;

  SELECT jsonb_agg(
    jsonb_build_object('text', content, 'date', created_at)
  ) INTO v_wishes
  FROM public.wishes
  WHERE profile_id = v_rec.profile_id AND is_deleted = false;

  -- Đánh dấu mã đã dùng (thu hồi)
  UPDATE public.recovery_codes SET revoked = true, attempts = attempts + 1 WHERE id = v_rec.id;

  -- Trả về dữ liệu đầy đủ cho client khôi phục
  RETURN jsonb_build_object(
    'success', true,
    'source_profile_id', v_rec.profile_id,
    'target_profile_id', v_curr_uid,
    'profile', jsonb_build_object(
      'name', v_profile.display_name,
      'gender', v_profile.gender,
      'onboardingCompleted', v_profile.onboarding_completed,
      'appearance', to_jsonb(v_appearance),
      'progress', to_jsonb(v_progress),
      'rosary', to_jsonb(v_rosary),
      'stats', to_jsonb(v_stats),
      'settings', to_jsonb(v_settings),
      'wishes', COALESCE(v_wishes, '[]'::jsonb)
    )
  );
END;
$$;

