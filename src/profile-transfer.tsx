import { useRef, useState } from 'react';
import { Copy, Download, Upload, ShieldAlert } from 'lucide-react';
import { createRecoveryCode, readRecoveryCode, sha256Hex, type Save } from './profile';
import { validateDisplayName } from './name-validation';
import { supabase, isSupabaseConfigured } from './supabase';

export function ProfileTransfer({
  profile,
  onRestore,
  notify,
}: {
  profile: Save;
  onRestore: (profile: Save) => void;
  notify: (text: string) => void;
}) {
  const [exported, setExported] = useState('');
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<Save | null>(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const output = useRef<HTMLTextAreaElement>(null);

  async function handleCreateCode() {
    setIsProcessing(true);
    try {
      const code = createRecoveryCode(profile);
      setExported(code);

      // Nếu có Supabase, đăng ký mã băm SHA-256 an toàn lên database
      if (isSupabaseConfigured && supabase) {
        const hash = await sha256Hex(code);
        await supabase.rpc('fn_register_recovery_code', { p_code_hash: hash });
      }

      notify('Đã tạo mã khôi phục an toàn.');
    } catch (err) {
      notify('Đã tạo mã khôi phục cục bộ.');
    } finally {
      setIsProcessing(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(exported);
      notify('Đã sao chép mã khôi phục.');
    } catch {
      output.current?.focus();
      output.current?.select();
      notify('Đã chọn mã. Hãy dùng lệnh Sao chép của trình duyệt.');
    }
  }

  async function handleVerifyCode() {
    setError('');
    const rawCode = input.trim();
    if (!rawCode) {
      setError('Vui lòng nhập mã khôi phục.');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Thử giải mã mã cấu trúc GMTU1
      let restored: Save | null = null;
      try {
        restored = readRecoveryCode(rawCode);
      } catch (localErr) {
        // Nếu không phải định dạng GMTU1, thử gọi endpoint cloud
        if (isSupabaseConfigured && supabase) {
          const hash = await sha256Hex(rawCode);
          const { data, error: rpcErr } = await supabase.rpc('fn_redeem_recovery_code', { p_code_hash: hash });
          if (!rpcErr && data?.profile) {
            restored = data.profile as Save;
          } else {
            throw new Error(rpcErr?.message || 'Mã khôi phục không tồn tại hoặc đã hết hạn.');
          }
        } else {
          throw localErr;
        }
      }

      if (!restored) {
        throw new Error('Mã khôi phục không hợp lệ.');
      }

      // Xác thực tên và giới tính của hồ sơ khôi phục
      const nameVal = validateDisplayName(restored.name);
      if (!nameVal.valid) {
        throw new Error('Hồ sơ trong mã khôi phục thiếu tên hợp lệ (' + (nameVal.error || 'Lỗi tên') + ').');
      }

      if (restored.gender !== 'male' && restored.gender !== 'female') {
        throw new Error('Hồ sơ trong mã khôi phục thiếu lựa chọn giới tính hợp lệ.');
      }

      setPreview(restored);
    } catch (e) {
      setError((e as Error).message || 'Mã khôi phục không hợp lệ.');
    } finally {
      setIsProcessing(false);
    }
  }

  const hasLocalProgress = profile.beadTotal > 0 || profile.completed.length > 0 || profile.wishes.length > 0;

  return (
    <div className="profile-transfer">
      <div className="wish-privacy-note" style={{ marginBottom: 12 }}>
        <p style={{ margin: 0, fontWeight: 500 }}>
          Ai có mã này có thể truy cập tiến trình và lời chúc của bạn. Hãy giữ mã riêng tư.
        </p>
        <small style={{ display: 'block', marginTop: 4, color: '#7a684b' }}>
          Nếu mất phiên làm việc và mất mã khôi phục, bạn sẽ không thể khôi phục chỉ bằng tên hiển thị.
        </small>
      </div>

      <small className="profile-id">Hồ sơ: {profile.guestId}</small>

      <button className="primary" disabled={isProcessing} onClick={handleCreateCode}>
        <Download size={16} />
        {isProcessing ? 'Đang tạo mã…' : 'Tạo mã khôi phục'}
      </button>

      {exported && (
        <>
          <label htmlFor="export-code">Mã khôi phục của bạn</label>
          <textarea ref={output} id="export-code" readOnly rows={3} value={exported} />
          <button className="text-action" onClick={copy}>
            <Copy size={15} />
            Sao chép mã
          </button>
        </>
      )}

      <label htmlFor="restore-code">Nhập mã khôi phục</label>
      <textarea
        id="restore-code"
        maxLength={100000}
        rows={3}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setPreview(null);
          setError('');
        }}
        placeholder="Dán mã khôi phục GMTU1.… vào đây"
      />

      {error && <p className="form-error" role="alert">{error}</p>}

      <button className="primary" disabled={!input.trim() || isProcessing} onClick={handleVerifyCode}>
        <Upload size={16} />
        {isProcessing ? 'Đang kiểm tra…' : 'Kiểm tra mã'}
      </button>

      {preview && (
        <section className="restore-confirm" role="alertdialog" aria-label="Xác nhận khôi phục hồ sơ">
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <ShieldAlert size={18} style={{ color: '#8a6c3f', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p>
                Tìm thấy hồ sơ: <strong>{preview.name || 'Khách ghé chùa'}</strong> · {preview.gender === 'female' ? 'Nữ' : 'Nam'} · {preview.beadTotal} hạt chuỗi.
              </p>
              {hasLocalProgress ? (
                <p style={{ color: '#8c4a2a', fontSize: 11, margin: '6px 0' }}>
                  Thiết bị này đã có tiến trình ({profile.beadTotal} hạt, {profile.completed.length} hoạt động). Nếu tiếp tục, dữ liệu hiện tại sẽ được thay bằng hồ sơ từ mã khôi phục.
                </p>
              ) : (
                <p style={{ fontSize: 11, margin: '6px 0' }}>
                  Hồ sơ và ngoại hình sẽ được áp dụng cho thiết bị này.
                </p>
              )}
            </div>
          </div>
          <div>
            <button onClick={() => setPreview(null)}>Giữ hồ sơ hiện tại</button>
            <button onClick={() => onRestore(preview)}>Xác nhận khôi phục</button>
          </div>
        </section>
      )}
    </div>
  );
}
