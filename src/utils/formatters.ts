/**
 * 格式化人民币金额 (如 ￥3,900.00 / ￥-205.50)
 */
export const formatCurrency = (amount: number, showPlus: boolean = false): string => {
  const isNegative = amount < 0;
  const absVal = Math.abs(amount).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (isNegative) {
    return `￥-${absVal}`;
  }
  if (showPlus && amount > 0) {
    return `￥+${absVal}`;
  }
  return `￥${absVal}`;
};

/**
 * 格式化日期为更易读的英文/中文组合或拟真热敏小票时间戳
 */
export const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${y}.${m}.${d}`;
};

/**
 * 生成随机但确定性的物理收据单号，如 REC-20260807-8842
 */
export const generateReceiptNo = (dateStr?: string): string => {
  const cleanDate = (dateStr || new Date().toISOString().split('T')[0]).replace(/-/g, '');
  const hash = Math.floor(Math.abs(Math.sin(cleanDate.length * 999) * 10000));
  return `REC-${cleanDate}-${String(hash).padStart(4, '0')}`;
};

/**
 * 获取交易显示名称（带类别兜底）
 */
export const getTransactionName = (t: { title: string; category: string; subcategory: string }): string => {
  if (t.title && t.title.trim()) {
    return t.title.trim();
  }
  if (t.subcategory && t.subcategory.trim()) {
    return `${t.category} / ${t.subcategory}`;
  }
  return t.category || '日常支出';
};
