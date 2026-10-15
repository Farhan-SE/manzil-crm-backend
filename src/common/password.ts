import * as crypto from 'crypto';

/** A first-login password with at least one of each character class. */
export function generatePassword(length = 12): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const special = '!@#$%^&*()_+-=';
    const all = upper + lower + digits + special;

    const pick = (chars: string) => chars[crypto.randomInt(chars.length)];

    const required = [pick(upper), pick(lower), pick(digits), pick(special)];
    const rest = Array.from({ length: length - required.length }, () => pick(all));
    const passwordChars = [...required, ...rest];

    for (let i = passwordChars.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
    }

    return passwordChars.join('');
}
