import { BillingCycle } from '@movie-server/shared';
import { addBillingCycle, addDays, priceForCycle } from './period';

describe('billing period helpers', () => {
  it('adds a calendar month and year', () => {
    const start = new Date(2026, 0, 15, 12);
    const month = addBillingCycle(start, BillingCycle.Monthly);
    expect(month.getMonth()).toBe(1);
    expect(month.getDate()).toBe(15);
    const year = addBillingCycle(new Date(2026, 2, 1, 12), BillingCycle.Yearly);
    expect(year.getFullYear()).toBe(2027);
  });

  it('adds grace days and selects cycle prices', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    expect(addDays(start, 3).toISOString()).toBe('2026-01-04T00:00:00.000Z');
    expect(priceForCycle(999, 9999, BillingCycle.Monthly)).toBe(999);
    expect(priceForCycle(999, 9999, BillingCycle.Yearly)).toBe(9999);
  });
});
