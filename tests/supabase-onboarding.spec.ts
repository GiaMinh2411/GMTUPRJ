import { test, expect } from '@playwright/test';
import { validateDisplayName, normalizeDisplayName, countUnicodeGraphemes, isValidGender } from '../src/name-validation';
import { normalizeProfile, sha256Hex } from '../src/profile';

test.describe('Kiểm tra hàm chuẩn hóa và xác thực tên/giới tính', () => {
  test('tên tiếng Việt có dấu, NFC, khoảng trắng và độ dài 2-30 ký tự', () => {
    // Valid Vietnamese names
    expect(validateDisplayName('Minh An').valid).toBe(true);
    expect(validateDisplayName('Trần Thị Diệu Hương').valid).toBe(true);
    expect(validateDisplayName('  Nguyễn Ái Quốc  ').valid).toBe(true);
    expect(normalizeDisplayName('  Nguyễn Ái Quốc  ')).toBe('Nguyễn Ái Quốc');
    expect(validateDisplayName('A B').valid).toBe(true); // 3 graphemes
    expect(validateDisplayName('Đỗ').valid).toBe(true); // 2 graphemes

    // Exact 30 characters
    const exact30 = 'ChùaMộtCộtHàNộiViệtNamBìnhAn12';
    expect(countUnicodeGraphemes(exact30)).toBe(30);
    expect(validateDisplayName(exact30).valid).toBe(true);

    // Invalid: too short, empty, whitespace only
    expect(validateDisplayName('').valid).toBe(false);
    expect(validateDisplayName('   ').valid).toBe(false);
    expect(validateDisplayName('A').valid).toBe(false);

    // Invalid: > 30 graphemes
    expect(validateDisplayName(exact30 + 'a').valid).toBe(false);

    // Invalid: invisible characters, control chars, zero-width space
    expect(validateDisplayName('Minh\u200BAn').valid).toBe(false);
    expect(validateDisplayName('Minh\u0000An').valid).toBe(false);

    // Cross-player duplicates allowed (functions do not block duplicate names)
    expect(validateDisplayName('Minh An').normalized).toBe('Minh An');
  });

  test('giới tính bắt buộc: chỉ chấp nhận male hoặc female', () => {
    expect(isValidGender('male')).toBe(true);
    expect(isValidGender('female')).toBe(true);
    expect(isValidGender(null)).toBe(false);
    expect(isValidGender(undefined)).toBe(false);
    expect(isValidGender('')).toBe(false);
    expect(isValidGender('other')).toBe(false);
  });

  test('hồ sơ cũ thiếu giới tính không được tự đoán là male', () => {
    const legacy = normalizeProfile({ name: 'Tuệ Minh', beadTotal: 108 });
    expect(legacy.gender).toBeNull();
    expect(legacy.onboardingCompleted).toBe(false);
  });

  test('băm SHA-256 mã khôi phục tạo chuỗi hex 64 ký tự an toàn', async () => {
    const hash = await sha256Hex('GMTU1.test-code.12345678');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    const hash2 = await sha256Hex('GMTU1.test-code.12345678');
    expect(hash).toBe(hash2);
    const hashDifferent = await sha256Hex('GMTU1.different-code.12345678');
    expect(hash).not.toBe(hashDifferent);
  });
});

test.describe('Luồng Onboarding và Giao diện người dùng', () => {
  test('người chơi mới: nút Vào chùa bị vô hiệu hóa khi thiếu tên hoặc giới tính, mở khóa khi hợp lệ', async ({ page }) => {
    await page.goto('/');

    const enterButton = page.getByRole('button', { name: 'Vào chùa', exact: true });
    const nameInput = page.getByLabel('Tên của bạn');
    const maleButton = page.getByRole('button', { name: 'Nam', exact: true });
    const femaleButton = page.getByRole('button', { name: 'Nữ', exact: true });

    // Ban đầu nút Vào chùa bị vô hiệu hóa
    await expect(enterButton).toBeDisabled();
    await expect(maleButton).toHaveAttribute('aria-pressed', 'false');
    await expect(femaleButton).toHaveAttribute('aria-pressed', 'false');

    // Chạm vào ô tên và blur ra ngoài mà không nhập -> hiện cảnh báo
    await nameInput.focus();
    await nameInput.blur();
    await expect(page.getByRole('alert')).toContainText('Vui lòng nhập tên từ 2–30 ký tự');
    await expect(enterButton).toBeDisabled();

    // Nhập tên hợp lệ
    await nameInput.fill('An Nhiên');
    await expect(page.locator('.char-counter')).toHaveText('8/30');

    // Tên đã hợp lệ nhưng chưa chọn giới tính -> nút vẫn disabled
    await expect(enterButton).toBeDisabled();

    // Chọn giới tính Nữ -> nút Nữ sáng, xem trước avatar cập nhật
    await femaleButton.click();
    await expect(femaleButton).toHaveAttribute('aria-pressed', 'true');
    await expect(maleButton).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.avatar-preview')).toHaveAttribute('data-gender', 'female');

    // Bây giờ cả tên và giới tính đều hợp lệ -> nút Vào chùa được kích hoạt!
    await expect(enterButton).toBeEnabled();

    // Chọn sang Nam -> xem trước đổi sang Nam
    await maleButton.click();
    await expect(maleButton).toHaveAttribute('aria-pressed', 'true');
    await expect(femaleButton).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.avatar-preview')).toHaveAttribute('data-gender', 'male');
    await expect(enterButton).toBeEnabled();

    // Nhấn Vào chùa -> vào sân chùa thành công
    await enterButton.click();
    await expect(page.locator('.location')).toContainText('An Nhiên');
  });

  test('người chơi quay lại: hồ sơ đã hợp lệ hiển thị tên, giới tính và nút Tiếp tục', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('an-nhien-v1', JSON.stringify({
        quality: 'low',
        name: 'Tuệ Tâm',
        gender: 'female',
        onboardingCompleted: true,
      }));
    });

    await page.goto('/');

    // Hiển thị lời chào mừng trở lại
    await expect(page.locator('.welcome-returning-pill')).toContainText('Chào mừng trở lại, Tuệ Tâm!');
    await expect(page.getByLabel('Tên của bạn')).toHaveValue('Tuệ Tâm');
    await expect(page.getByRole('button', { name: 'Nữ', exact: true })).toHaveAttribute('aria-pressed', 'true');

    // Nút hiển thị chữ "Tiếp tục"
    const enterButton = page.getByRole('button', { name: 'Vào chùa', exact: true });
    await expect(enterButton).toBeEnabled();
    await expect(enterButton).toContainText('Tiếp tục');

    // Bấm Tiếp tục vào chùa ngay không cần gõ lại
    await enterButton.click();
    await expect(page.locator('.location')).toContainText('Tuệ Tâm');
  });

  test('hồ sơ cũ thiếu giới tính: bắt buộc chọn giới tính trước khi vào chùa', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('an-nhien-v1', JSON.stringify({
        quality: 'low',
        name: 'Phật Tử Cũ',
        // gender is missing!
        onboardingCompleted: false,
      }));
    });

    await page.goto('/');

    const enterButton = page.getByRole('button', { name: 'Vào chùa', exact: true });
    // Vì thiếu giới tính, nút không được phép bật
    await expect(enterButton).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Nam', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'Nữ', exact: true })).toHaveAttribute('aria-pressed', 'false');

    // Chọn Nam -> kích hoạt nút
    await page.getByRole('button', { name: 'Nam', exact: true }).click();
    await expect(enterButton).toBeEnabled();
  });

  test('trang quản trị /admin mở trực tiếp không cần nhập tên hay vào chùa', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Quản trị GM TỰ' })).toBeVisible();
    await expect(page.getByLabel('Email quản trị')).toBeVisible();
    await expect(page.getByLabel('Mật khẩu')).toBeVisible();
  });

  test('nút khôi phục tiến trình từ mã mở được ngay tại màn hình chào', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Khôi phục tiến trình', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Lưu và khôi phục' })).toBeVisible();
    await expect(page.getByLabel('Nhập mã khôi phục')).toBeVisible();
  });
});
