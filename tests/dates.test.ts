import { expect,it } from 'vitest';
import { jakartaDay,ledgerToday } from '../src/lib/dates';
it('uses Jakarta calendar days across UTC year and month boundaries',()=>{
 const at=new Date('2026-12-31T18:00:00Z');
 expect(jakartaDay(at)).toBe('2027-01-01');
 expect(ledgerToday(at).toISOString()).toBe('2027-01-01T05:00:00.000Z');
});
it('keeps the previous Jakarta day before midnight',()=>{
 expect(ledgerToday(new Date('2026-12-31T16:00:00Z')).toISOString()).toBe('2026-12-31T05:00:00.000Z');
});
