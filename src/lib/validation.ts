import { z } from 'zod';
const withinPasswordLimit = (value:string) => new TextEncoder().encode(value).byteLength <= 72;
const lengthMessage = 'Kata sandi terlalu panjang. Gunakan kata sandi yang lebih pendek.';
export const passwordInput = z.string().min(1).max(72).refine(withinPasswordLimit,lengthMessage);
export const passwordSchema = z.string().min(12,'Gunakan minimal 12 karakter').max(72)
  .regex(/[A-Z]/,'Tambahkan huruf besar').regex(/[a-z]/,'Tambahkan huruf kecil').regex(/[0-9]/,'Tambahkan angka')
  .refine(withinPasswordLimit,lengthMessage);
