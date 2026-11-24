import type { Transaction } from '../types';

/**
 * 解析粘贴的原始账本文本（Tab 或双空格分隔）为交易列表。
 * 支持两种格式：
 *   1. 标题\t日期\t金额\t成员\t分类/子分类\t账本[\t转入账本]
 *   2. 日期\t金额\t成员\t分类/子分类\t账本[\t转入账本]
 * 也支持在账本列写成 "账本A->账本B" 或 "账本A→账本B" 表示转账。
 */
export const parseRawLedgerText = (text: string): Transaction[] => {
  const lines = text.split('\n');
  const results: Transaction[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const parts = line.split('\t').map((p) => p.trim());
    const fields = parts.length >= 3 ? parts : line.split(/\s{2,}/).map((p) => p.trim());

    if (fields.length < 3) return;

    let title = fields[0] || '';
    let dateStr = fields[1] || '';
    let rawAmount = fields[2] || '0';
    let member = fields[3] || '默认';
    let categoryFull = fields[4] || '其它';
    let ledger = fields[5] || 'Default';
    let toLedger = fields[6] || '';

    if (/^\d{4}-\d{2}-\d{2}$/.test(fields[0])) {
      title = '';
      dateStr = fields[0];
      rawAmount = fields[1] || '0';
      member = fields[2] || '默认';
      categoryFull = fields[3] || '其它';
      ledger = fields[4] || 'Default';
      toLedger = fields[5] || '';
    }

    const arrowMatch = ledger.match(/^(.+?)\s*(?:->|→)\s*(.+)$/);
    if (arrowMatch) {
      ledger = arrowMatch[1].trim() || 'Default';
      toLedger = arrowMatch[2].trim();
    }

    const cleanAmountStr = rawAmount.replace(/[￥,]/g, '');
    let amount = parseFloat(cleanAmountStr) || 0;

    let category = categoryFull;
    let subcategory = '';
    if (categoryFull.includes('/')) {
      const catParts = categoryFull.split('/');
      category = catParts[0];
      subcategory = catParts.slice(1).join('/');
    }

    const isTransfer = toLedger.length > 0;
    if (isTransfer) {
      amount = Math.abs(amount);
      if (!category || category === '其它') category = '转账';
    }

    results.push({
      id: `parse_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      title,
      date: dateStr || new Date().toISOString().split('T')[0],
      amount,
      member,
      category,
      subcategory,
      ledger,
      tx_type: isTransfer ? 'transfer' : 'normal',
      to_ledger: isTransfer ? toLedger : '',
    });
  });

  return results;
};
