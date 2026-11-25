import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import {
  CSV_TEMPLATE_HEADERS,
  buildCsvDemoTemplate,
  buildCsvExport,
  parseLedgerImport,
  parseRawLedgerText,
} from './parser';

describe('parseRawLedgerText (legacy compatibility)', () => {
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

  it('parses transfer rows using arrow notation or 7th column', () => {
    const rows = parseRawLedgerText(
      '定存\t2026-10-16\t2000\t荔枝\t转账\tDefault→储蓄\n搬砖\t2026-10-17\t-500\t扶正\t其它\tDefault\t投资'
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      tx_type: 'transfer',
      ledger: 'Default',
      to_ledger: '储蓄',
      amount: 2000,
      category: '转账',
      member: '',
    });
    expect(rows[1]).toMatchObject({
      tx_type: 'transfer',
      ledger: 'Default',
      to_ledger: '投资',
      amount: 500,
      category: '转账',
      member: '',
    });
  });
});

describe('parseLedgerImport (standard CSV & validation)', () => {
  it('parses the built-in 3-type demo template cleanly with zero issues', () => {
    const csv = buildCsvDemoTemplate('储蓄');
    const result = parseLedgerImport(csv);

    expect(result.detectedFormat).toBe('csv-header');
    expect(result.issues).toHaveLength(0);
    expect(result.summary).toEqual({ total: 3, expense: 1, income: 1, transfer: 1 });

    expect(result.transactions[0]).toMatchObject({
      tx_type: 'normal',
      date: '2026-11-19',
      amount: -38.5,
      member: '荔枝',
      category: '餐饮',
      subcategory: '午餐',
      title: '牛肉面',
      ledger: 'Default',
      to_ledger: '',
    });

    expect(result.transactions[1]).toMatchObject({
      tx_type: 'normal',
      date: '2026-11-18',
      amount: 15000,
      member: '扶正',
      category: '收入',
      subcategory: '工资',
      title: '11月工资',
      ledger: 'Default',
      to_ledger: '',
    });

    expect(result.transactions[2]).toMatchObject({
      tx_type: 'transfer',
      date: '2026-11-17',
      amount: 2000,
      member: '',
      category: '转账',
      subcategory: '内部转账',
      title: '月度定存',
      ledger: 'Default',
      to_ledger: '储蓄',
    });
  });

  it('parses headerless rows starting with 支出/收入/转账', () => {
    const raw = [
      '支出,2026/11/9,42.5,荔枝,餐饮/早餐,,豆浆油条,Default',
      '收入,2026-11-10,+800,扶正,收入,兼职,设计费,Default',
      '转账,2026.11.11,-1000,,,,调拨,Default→储蓄',
    ].join('\n');

    const result = parseLedgerImport(raw);
    expect(result.detectedFormat).toBe('csv-typed');
    expect(result.issues).toHaveLength(0);
    expect(result.transactions[0]).toMatchObject({
      date: '2026-11-09',
      amount: -42.5,
      category: '餐饮',
      subcategory: '早餐',
    });
    expect(result.transactions[1]).toMatchObject({
      date: '2026-11-10',
      amount: 800,
      category: '收入',
      subcategory: '兼职',
    });
    expect(result.transactions[2]).toMatchObject({
      tx_type: 'transfer',
      date: '2026-11-11',
      amount: 1000,
      member: '',
      category: '转账',
      subcategory: '内部转账',
      ledger: 'Default',
      to_ledger: '储蓄',
    });
  });

  it('round-trips files exported by Admin CSV Export (BOM + CRLF + quotes)', () => {
    const exportedCsv =
      '﻿id,date,tx_type,title,amount,member,category,subcategory,ledger,to_ledger\r\n' +
      'tx_1,2026-11-19,normal,"牛肉面, ""加蛋""",-42.5,荔枝,餐饮,午餐,"Default",""\r\n' +
      'tx_2,2026-11-18,normal,"11月工资",15000,扶正,收入,工资,"Default",""\r\n' +
      'tx_3,2026-11-17,transfer,"定存",2000,"","转账","内部转账","Default","储蓄"\r\n';

    const result = parseLedgerImport(exportedCsv);
    expect(result.detectedFormat).toBe('csv-header');
    expect(result.issues).toHaveLength(0);
    expect(result.summary).toEqual({ total: 3, expense: 1, income: 1, transfer: 1 });
    expect(result.transactions[0]).toMatchObject({
      title: '牛肉面, "加蛋"',
      amount: -42.5,
      ledger: 'Default',
    });
    expect(result.transactions[0].id.startsWith('parse_')).toBe(true);
    expect(result.transactions[2]).toMatchObject({
      tx_type: 'transfer',
      amount: 2000,
      ledger: 'Default',
      to_ledger: '储蓄',
    });
  });

  it('supports Chinese full-width commas when no ASCII comma is present', () => {
    const raw =
      '类型，日期，金额，成员，主分类，二级分类，备注，账本，转入账本\n' +
      '支出，2026-11-19，25，荔枝，餐饮，咖啡，美式，Default，';
    const result = parseLedgerImport(raw);
    expect(result.issues).toHaveLength(0);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({
      amount: -25,
      title: '美式',
      category: '餐饮',
      subcategory: '咖啡',
    });
  });

  it('reports row-level validation issues without discarding valid rows', () => {
    const raw = [
      '类型,日期,金额,成员,主分类,二级分类,备注,账本,转入账本',
      '支出,2026-11-19,38.50,荔枝,餐饮,午餐,牛肉面,Default,',
      '支出,2026-02-30,10,荔枝,餐饮,午餐,无效日期,Default,',
      '转账,2026-11-17,500,,,,缺少转入,Default,',
      '转账,2026-11-17,500,,,,同账本,Default,Default',
      '未知,2026-11-17,50,荔枝,餐饮,午餐,未知类型,Default,',
      '收入,2026-11-18,0,扶正,收入,工资,零金额,Default,',
    ].join('\n');

    const result = parseLedgerImport(raw);
    expect(result.transactions).toHaveLength(1);
    expect(result.issues).toHaveLength(5);
    expect(result.issues.map((i) => i.lineNumber)).toEqual([3, 4, 5, 6, 7]);
    expect(result.issues[0].message).toContain('日期格式');
    expect(result.issues[1].message).toContain('转入账本');
    expect(result.issues[2].message).toContain('不能相同');
    expect(result.issues[3].message).toContain('无法识别的类型');
    expect(result.issues[4].message).toContain('金额');
  });
});

describe('buildCsvExport (import-compatible standard CSV)', () => {
  it('exports expense, income, and transfer rows matching CSV_TEMPLATE_HEADERS and round-trips losslessly', () => {
    const sample: Transaction[] = [
      {
        id: 't1',
        date: '2026-11-19',
        title: '牛肉面, "加蛋"\t打包\n备注',
        amount: -38.5,
        member: '荔枝',
        category: '餐饮',
        subcategory: '午餐',
        ledger: 'Default',
        tx_type: 'normal',
        to_ledger: '',
      },
      {
        id: 't2',
        date: '2026-11-18',
        title: '11月工资',
        amount: 15000,
        member: '扶正',
        category: '收入',
        subcategory: '工资',
        ledger: '',
        tx_type: 'normal',
        to_ledger: '',
      },
      {
        id: 't3',
        date: '2026-11-17',
        title: '月度定存',
        amount: 2000,
        member: '应被清空',
        category: '转账',
        subcategory: '内部转账',
        ledger: 'Default',
        tx_type: 'transfer',
        to_ledger: '储蓄',
      },
    ];

    const exported = buildCsvExport(sample);
    expect(exported.headers).toEqual(CSV_TEMPLATE_HEADERS);
    expect(exported.summary).toEqual({ total: 3, expense: 1, income: 1, transfer: 1 });
    expect(exported.validation.compatible).toBe(true);
    expect(exported.validation.issues).toHaveLength(0);
    expect(exported.csvText.split('\n')[0]).toBe(CSV_TEMPLATE_HEADERS.join(','));

    // Re-import exported CSV text and verify every field round-trips cleanly
    const reimported = parseLedgerImport(exported.csvText);
    expect(reimported.detectedFormat).toBe('csv-header');
    expect(reimported.issues).toHaveLength(0);
    expect(reimported.transactions).toHaveLength(3);

    expect(reimported.transactions[0]).toMatchObject({
      tx_type: 'normal',
      date: '2026-11-19',
      amount: -38.5,
      member: '荔枝',
      category: '餐饮',
      subcategory: '午餐',
      title: '牛肉面, "加蛋" 打包 备注',
      ledger: 'Default',
      to_ledger: '',
    });

    expect(reimported.transactions[1]).toMatchObject({
      tx_type: 'normal',
      date: '2026-11-18',
      amount: 15000,
      member: '扶正',
      category: '收入',
      subcategory: '工资',
      title: '11月工资',
      ledger: 'Default',
      to_ledger: '',
    });

    expect(reimported.transactions[2]).toMatchObject({
      tx_type: 'transfer',
      date: '2026-11-17',
      amount: 2000,
      member: '',
      category: '转账',
      subcategory: '内部转账',
      title: '月度定存',
      ledger: 'Default',
      to_ledger: '储蓄',
    });
  });

  it('flags incompatible rows (zero amount or invalid transfer) during export self-check', () => {
    const sample: Transaction[] = [
      {
        id: 'bad_1',
        date: '2026-11-19',
        title: '零金额草稿',
        amount: 0,
        member: '荔枝',
        category: '餐饮',
        subcategory: '午餐',
        ledger: 'Default',
        tx_type: 'normal',
        to_ledger: '',
      },
      {
        id: 'bad_2',
        date: '2026-11-18',
        title: '缺目标账本',
        amount: 500,
        member: '',
        category: '转账',
        subcategory: '内部转账',
        ledger: 'Default',
        tx_type: 'transfer',
        to_ledger: '',
      },
    ];

    const exported = buildCsvExport(sample, { bad_1: 'income' });
    expect(exported.rows[0].kind).toBe('income');
    expect(exported.validation.compatible).toBe(false);
    expect(exported.validation.issues).toHaveLength(2);
    expect(exported.validation.issues[0].lineNumber).toBe(2);
    expect(exported.validation.issues[1].lineNumber).toBe(3);
  });
});
