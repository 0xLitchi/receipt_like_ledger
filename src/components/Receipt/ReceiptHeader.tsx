import React from 'react';

/**
 * 小票抬头占位：目前刻意保持留白，不展示店名 / 月份 / 权限等描述性文字。
 * 分类汇总由 CategorySummary 单独渲染在明细表上方。
 */
export const ReceiptHeader: React.FC = () => <div className="pt-2" aria-hidden />;
