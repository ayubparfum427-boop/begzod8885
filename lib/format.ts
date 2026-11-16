export function normalizeUzbekPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let nineDigits = "";
  if (digits.length === 12 && digits.startsWith("998")) {
    nineDigits = digits.slice(3);
  } else if (digits.length === 9) {
    nineDigits = digits;
  } else {
    return null;
  }

  // Valid +998 XX XXX XX XX (9 digits after 998, operator/region code cannot start with 0)
  if (!/^[1-9]\d{8}$/.test(nineDigits)) {
    return null;
  }

  return `+998${nineDigits}`;
}

export function formatUzbekPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  const nine = digits.startsWith("998") ? digits.slice(3) : digits;
  if (nine.length !== 9) return phone;
  return `+998 ${nine.slice(0, 2)} ${nine.slice(2, 5)} ${nine.slice(5, 7)} ${nine.slice(7, 9)}`;
}

export function formatPhoneInputMask(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (
    digits.startsWith("998") &&
    (digits.length > 9 || value.trim().startsWith("+998"))
  ) {
    digits = digits.slice(3);
  }
  digits = digits.slice(0, 9);
  let result = "+998";
  if (digits.length > 0) result += " " + digits.slice(0, 2);
  if (digits.length > 2) result += " " + digits.slice(2, 5);
  if (digits.length > 5) result += " " + digits.slice(5, 7);
  if (digits.length > 7) result += " " + digits.slice(7, 9);
  return result;
}

export function formatSom(
  amount: number | null | undefined,
  currencyLabel = "so‘m"
): string {
  const num = Number(amount ?? 0);
  if (Number.isNaN(num)) return `0 ${currencyLabel}`;
  const formatted = Math.round(num)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${formatted} ${currencyLabel}`;
}

export function formatGrams(grams: number | null | undefined): string {
  const num = Number(grams ?? 0);
  if (Number.isNaN(num)) return "0 gr";
  const rounded = Number.isInteger(num)
    ? num.toString()
    : Number(num.toFixed(1)).toString();
  return `${rounded} gr`;
}

export function getTashkentDateKey(dateInput: Date | string | number): string {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  // Shift to UTC+5 (Asia/Tashkent has no DST)
  const tashkentMs = d.getTime() + 5 * 60 * 60 * 1000;
  const td = new Date(tashkentMs);
  const y = td.getUTCFullYear();
  const m = String(td.getUTCMonth() + 1).padStart(2, "0");
  const day = String(td.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateUZ(
  dateInput: Date | string | number | null | undefined
): string {
  if (!dateInput) return "—";
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [y, m, d] = dateInput.split("-");
    return `${d}.${m}.${y}`;
  }
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "—";
  const tashkentMs = d.getTime() + 5 * 60 * 60 * 1000;
  const td = new Date(tashkentMs);
  const day = String(td.getUTCDate()).padStart(2, "0");
  const month = String(td.getUTCMonth() + 1).padStart(2, "0");
  const year = td.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

export function formatDateTimeUZ(
  dateInput: Date | string | number | null | undefined
): string {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "—";
  const tashkentMs = d.getTime() + 5 * 60 * 60 * 1000;
  const td = new Date(tashkentMs);
  const day = String(td.getUTCDate()).padStart(2, "0");
  const month = String(td.getUTCMonth() + 1).padStart(2, "0");
  const year = td.getUTCFullYear();
  const hours = String(td.getUTCHours()).padStart(2, "0");
  const mins = String(td.getUTCMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${mins}`;
}
