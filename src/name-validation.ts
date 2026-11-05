/**
 * Module kiểm tra và chuẩn hóa tên hiển thị theo yêu cầu nghiêm ngặt của GM TỰ.
 * Dùng chung quy tắc giữa frontend và backend:
 * - Bắt buộc nhập, không tự sinh tên ngẫu nhiên.
 * - Chuẩn hóa Unicode NFC và loại khoảng trắng thừa ở hai đầu.
 * - Đếm số ký tự Unicode sau chuẩn hóa (Array.from), giới hạn từ 2 đến 30 ký tự.
 * - Cho phép tiếng Việt có dấu, chữ hoa, chữ thường và khoảng trắng giữa các từ.
 * - Không chấp nhận nội dung rỗng, chỉ gồm khoảng trắng, ký tự vô hình hoặc ký tự điều khiển.
 * - Không chặn tên tiếng Việt bằng regex chỉ hỗ trợ ASCII.
 */

// Regex phát hiện các ký tự điều khiển, ký tự định dạng vô hình (zero-width, BOM, invisible formatting)
const CONTROL_OR_INVISIBLE_REGEX = /[\u0000-\u001F\u007F-\u009F\u200B-\u200D\u2060\uFEFF]/;

/**
 * Chuẩn hóa tên: trim khoảng trắng và đưa về Unicode NFC.
 */
export function normalizeDisplayName(raw: string): string {
  if (typeof raw !== 'string') return '';
  return raw.normalize('NFC').trim();
}

/**
 * Đếm số lượng ký tự Unicode thực tế (code points) sau khi chuẩn hóa NFC.
 */
export function countUnicodeGraphemes(text: string): number {
  return Array.from(normalizeDisplayName(text)).length;
}

export type NameValidationResult = {
  valid: boolean;
  error?: string;
  normalized: string;
  charCount: number;
};

/**
 * Kiểm tra tính hợp lệ của tên hiển thị.
 */
export function validateDisplayName(raw: string): NameValidationResult {
  const normalized = normalizeDisplayName(raw);
  const charCount = Array.from(normalized).length;

  if (charCount === 0) {
    return {
      valid: false,
      error: 'Vui lòng nhập tên từ 2–30 ký tự.',
      normalized,
      charCount: 0,
    };
  }

  if (CONTROL_OR_INVISIBLE_REGEX.test(raw)) {
    return {
      valid: false,
      error: 'Tên chứa ký tự vô hình hoặc ký tự điều khiển không hợp lệ.',
      normalized,
      charCount,
    };
  }

  if (charCount < 2) {
    return {
      valid: false,
      error: 'Vui lòng nhập tên từ 2–30 ký tự.',
      normalized,
      charCount,
    };
  }

  if (charCount > 30) {
    return {
      valid: false,
      error: 'Tên không được vượt quá 30 ký tự.',
      normalized,
      charCount,
    };
  }

  // Đảm bảo tên không chỉ toàn dấu câu hoặc ký tự không thể đọc được
  // Cho phép chữ cái tiếng Việt, chữ số, dấu gạch ngang, dấu chấm, khoảng trắng
  const hasLetter = /\p{L}/u.test(normalized);
  if (!hasLetter) {
    return {
      valid: false,
      error: 'Tên hiển thị phải chứa ít nhất một chữ cái.',
      normalized,
      charCount,
    };
  }

  return {
    valid: true,
    normalized,
    charCount,
  };
}

/**
 * Kiểm tra tính hợp lệ của giới tính trong game.
 */
export function isValidGender(gender: unknown): gender is 'male' | 'female' {
  return gender === 'male' || gender === 'female';
}
