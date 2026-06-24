// Làm sạch dữ liệu form: trim đầu/cuối + bỏ ký tự điều khiển cho mọi chuỗi trong body.
// Bỏ qua field nhạy cảm (mật khẩu/token) để không vô tình đổi giá trị người dùng nhập.
const SKIP_KEYS = /pass(word)?|token|secret|otp|code/i;
const KEEP_CONTROL = new Set([9, 10, 13]); // tab, newline, carriage-return

function cleanString(s) {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if ((c < 32 && !KEEP_CONTROL.has(c)) || c === 127) continue; // drop control chars
    out += ch;
  }
  return out.trim();
}

function cleanValue(val, key) {
  if (typeof val === "string") {
    return SKIP_KEYS.test(key || "") ? val : cleanString(val);
  }
  if (Array.isArray(val)) return val.map((v) => cleanValue(v, key));
  if (val && typeof val === "object") {
    const out = {};
    for (const k of Object.keys(val)) out[k] = cleanValue(val[k], k);
    return out;
  }
  return val;
}

// Express middleware: chuẩn hoá req.body trước khi tới route/zod.
export function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = cleanValue(req.body, "");
  }
  next();
}
