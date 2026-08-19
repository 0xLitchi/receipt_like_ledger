import { describe, expect, it } from 'vitest';
import { parseRawLedgerText } from './parser';

describe('parseRawLedgerText', () => {
  it('parses tab-separated rows with title', () => {
    const rows = parseRawLedgerText('小雅退押金\t2026-08-07\t3900\t荔枝\t住房/押金\tDefault');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: '小雅退押金',
      date: '2026-08-07',
      amount: 3900,
      member: '荔枝',
      category: '住房',
      subcategory: '押金',
      ledger: 'Default',
    });
  });

  it('parses date-first rows without title', () => {
    const rows = parseRawLedgerText('2026-08-01\t-44.50\t扶正\t杂项/麻将\tDefault');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: '',
      date: '2026-08-01',
      amount: -44.5,
      member: '扶正',
      category: '杂项',
      subcategory: '麻将',
    });
  });

  it('strips ￥ symbol and thousand separators', () => {
    const rows = parseRawLedgerText('房租\t2026-08-01\t￥1,500.00\t荔枝\t住房/房租');
    expect(rows[0].amount).toBe(1500);
  });

  it('ignores empty lines and malformed rows', () => {
    const rows = parseRawLedgerText('\n   \n2026-08-01\t20\t扶正\n');
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(20);
  });
});
