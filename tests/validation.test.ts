import { expect,it } from 'vitest';
import { passwordInput,passwordSchema } from '../src/lib/validation';
it('prevents bcrypt truncation for ASCII and multibyte passwords',()=>{
 expect(passwordSchema.parse('StrongPassword123!')).toBe('StrongPassword123!');
 expect(passwordSchema.parse('Ab1'+'x'.repeat(69))).toHaveLength(72);
 expect(()=>passwordSchema.parse('Ab1'+'x'.repeat(70))).toThrow();
 expect(()=>passwordInput.parse('Ab1'+'é'.repeat(35))).toThrow();
 expect(()=>passwordSchema.parse('Ab1'+'é'.repeat(35))).toThrow();
 expect(()=>passwordSchema.parse('short1A')).toThrow();
});
