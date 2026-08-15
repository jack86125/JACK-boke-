"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

// 定义操作的类型
export type OperationType = 'POST' | 'CHATTER' | 'CONFIG' | 'GALLERY' | 'FRIEND'
  | 'sync_photowall' | 'sync_friends' | 'sync_projects' | 'create_moment' | 'publish_article';

export interface Operation {
  id: string;
  type: OperationType;
  label: string;      // 显示在列表里的简短描述，如 "修改文章：GNN研究"
  description: string; // 详细描述
  timestamp: string;
  payload: any;       // 实际要修改的数据内容
  value?: any;        // Navbar 更新本地时实际读取的字段(gallery/friends/projects 同步用)
  key?: any;          // settings 配置暂存时附带,运行时透传
}

interface OperationContextType {
  operations: Operation[];
  // 调用方习惯性传 id/timestamp,且 description 常省略;id/timestamp 统一由 provider 生成,description 兜底空串
  addOperation: (op: { type: OperationType; label: string } & Partial<Omit<Operation, 'type' | 'label'>>) => void;
  removeOperation: (id: string) => void;
  clearOperations: () => void;
}

const OperationContext = createContext<OperationContextType | undefined>(undefined);

export function OperationProvider({ children }: { children: React.ReactNode }) {
  const [operations, setOperations] = useState<Operation[]>([]);

  // 添加操作（如果同类型的操作已存在，则覆盖，防止重复积攒）
  const addOperation = (op: { type: OperationType; label: string } & Partial<Omit<Operation, 'type' | 'label'>>) => {
    // 调用方传入的 id/timestamp 忽略,统一生成
    const newOp: Operation = {
      type: op.type,
      label: op.label,
      description: op.description ?? '',
      payload: op.payload,
      value: op.value,
      key: op.key,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setOperations(prev => {
      // 如果是修改同一个文件，先过滤掉旧的，再加新的
      const filtered = prev.filter(item => !(item.type === op.type && item.label === op.label));
      return [...filtered, newOp];
    });
  };

  const removeOperation = (id: string) => {
    setOperations(prev => prev.filter(op => op.id !== id));
  };

  const clearOperations = () => setOperations([]);

  return (
    <OperationContext.Provider value={{ operations, addOperation, removeOperation, clearOperations }}>
      {children}
    </OperationContext.Provider>
  );
}

// 导出 Hook 方便其他组件调用
export const useOperations = () => {
  const context = useContext(OperationContext);
  if (!context) throw new Error("useOperations must be used within an OperationProvider");
  return context;
};