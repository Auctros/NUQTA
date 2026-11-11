import { localDateKey } from '../lib/dateKey';
import React, { useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { ExpenseRecord } from '../types';
import { NuqtaIcon } from './NuqtaIcon';

export const FinanceView: React.FC = () => {
  const {
    expenses,
    savingsGoals,
    addExpense,
    deleteExpense,
    addSavingsGoal,
    updateSavingsGoal,
    profile
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [userBudget, setUserBudget] = useState<number>(3000);

  // Expense form
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formType, setFormType] = useState<ExpenseRecord['type']>('expense');
  const [formCategory, setFormCategory] = useState<ExpenseRecord['category']>('food');

  // Savings form
  const [savingName, setSavingName] = useState('');
  const [savingTarget, setSavingTarget] = useState(1000);
  const [savingInitial, setSavingInitial] = useState(0);

  const currentMonthStr = localDateKey().slice(0, 7); // YYYY-MM
  const monthExpenses = expenses.filter((e) => e.date?.startsWith(currentMonthStr));

  const totalSpent = monthExpenses
    .filter((e) => e.type !== 'income')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalIncome = monthExpenses
    .filter((e) => e.type === 'income')
    .reduce((sum, e) => sum + e.amount, 0);

  const remainingBudget = userBudget - totalSpent;

  const categoryLabels: Record<string, string> = {
    food: isAr ? 'طعام وغذاء' : 'Food & Dining',
    transport: isAr ? 'مواصلات ونقل' : 'Transport',
    housing: isAr ? 'سكن وفواتير' : 'Housing & Bills',
    tech: isAr ? 'تقنية وأدوات' : 'Tech & Tools',
    leisure: isAr ? 'ترفيه وأنشطة' : 'Leisure & Fun',
    health: isAr ? 'صحة وعلاج' : 'Health',
    savings: isAr ? 'ادخار واستثمار' : 'Savings'
  };

  const categoryIcons: Record<string, string> = {
    food: '⌁',
    transport: '↗',
    housing: '⌂',
    tech: '⌘',
    leisure: '✳',
    health: '◔',
    savings: '◎'
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(formAmount);
    if (!formTitle.trim() || isNaN(num) || num <= 0) return;

    addExpense({
      title: formTitle.trim(),
      amount: num,
      type: formType,
      category: formCategory,
      date: localDateKey()
    });

    setFormTitle('');
    setFormAmount('');
    setIsModalOpen(false);
  };

  const handleCreateSaving = (e: React.FormEvent) => {
    e.preventDefault();
    if (!savingName.trim()) return;

    addSavingsGoal({
      title: savingName.trim(),
      targetAmount: Number(savingTarget) || 1000,
      currentAmount: Number(savingInitial) || 0,
      targetDate: localDateKey(new Date(Date.now() + 180 * 86400000))
    });

    setSavingName('');
    setIsSavingsModalOpen(false);
  };

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="line"></span>
            <span>NUQTA / FINANCE</span>
          </div>
          <h1>{isAr ? 'المالية والمصروفات' : 'Finance & Cashflow'}</h1>
          <p>
            {isAr
              ? 'متابعة واعية للمصروفات، ميزانية مرنة، وحصيلة ادخار للحرية والاستقرار.'
              : 'Conscious cashflow logging, adaptive monthly limits, and wealth reserve goals.'}
          </p>
        </div>
        <div className="heading-actions">
          <button className="btn primary" onClick={() => setIsModalOpen(true)}>
            <span className="btn-icon">+</span>
            <span>{isAr ? 'إضافة معاملة' : 'Log Transaction'}</span>
          </button>
        </div>
      </div>

      {/* Top 3 Summary Cards */}
      <div className="money-summary">
        <div className="panel money-card">
          <span className="money-label">{isAr ? 'إجمالي المصروفات' : 'Total Spending'}</span>
          <strong>${totalSpent.toLocaleString()}</strong>
          <small>{isAr ? 'مصروفات هذا الشهر' : 'Outflow this month'}</small>
        </div>

        <div className="panel money-card">
          <span className="money-label">{isAr ? 'المتبقي من الميزانية' : 'Remaining Budget'}</span>
          <strong style={{ color: remainingBudget < 0 ? 'var(--red)' : 'var(--accent)' }}>
            ${remainingBudget.toLocaleString()}
          </strong>
          <small>{isAr ? `من ميزانية: $${userBudget}` : `out of $${userBudget}`}</small>
        </div>

        <div className="panel money-card">
          <span className="money-label">{isAr ? 'إجمالي الدخل' : 'Total Income'}</span>
          <strong>${totalIncome.toLocaleString()}</strong>
          <small>{isAr ? 'دخل هذا الشهر' : 'Inflow this month'}</small>
        </div>
      </div>

      <div className="finance-layout">
        {/* Left Column: Recent Transactions */}
        <section className="panel panel-pad">
          <div className="panel-heading">
            <div>
              <h2>{isAr ? 'المعاملات الأخيرة' : 'Recent Transactions'}</h2>
              <p>{monthExpenses.length} {isAr ? 'معاملة هذا الشهر' : 'entries this month'}</p>
            </div>
            <button className="btn subtle small" onClick={() => setIsBudgetModalOpen(true)}>
              {isAr ? 'تعديل الميزانية' : 'Set Budget'}
            </button>
          </div>

          {expenses.length === 0 ? (
            <div className="empty-inline">
              {isAr ? 'لا توجد معاملات مسجلة بعد' : 'No transactions recorded yet'}
              <br />
              <button
                className="btn small primary"
                style={{ marginTop: '10px' }}
                onClick={() => setIsModalOpen(true)}
              >
                + {isAr ? 'إضافة مصروف' : 'Add Expense'}
              </button>
            </div>
          ) : (
            <div>
              {expenses.slice(0, 10).map((entry) => {
                const isInc = entry.type === 'income';
                return (
                  <div key={entry.id} className="expense-row">
                    <span className="expense-icon">
                      {isInc ? '↗' : categoryIcons[entry.category] || '·'}
                    </span>
                    <div className="expense-detail">
                      <strong>{entry.title}</strong>
                      <small>
                        {categoryLabels[entry.category] || entry.category} · {entry.date}
                      </small>
                    </div>
                    <span
                      className="expense-value"
                      style={{ color: isInc ? 'var(--accent)' : 'var(--text)' }}
                    >
                      {isInc ? '+' : '−'}${entry.amount.toLocaleString()}
                    </span>
                    <button
                      className="mini-icon"
                      onClick={() => deleteExpense(entry.id)}
                      title={isAr ? 'حذف' : 'Delete'}
                    >
                      <NuqtaIcon name="trash" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Budget Breakdown & Savings Goals */}
        <aside>
          {/* Budget Progress Panel */}
          <section className="panel panel-pad">
            <div className="panel-heading">
              <div>
                <h2>{isAr ? 'ميزانية الشهر' : 'Monthly Budget'}</h2>
                <p>{isAr ? `المنصرف: $${totalSpent}` : `Spent: $${totalSpent}`}</p>
              </div>
              <span className={`tag ${remainingBudget < 0 ? 'red' : 'green'}`}>
                {remainingBudget < 0 ? '−' : '+'}${Math.abs(remainingBudget).toLocaleString()}
              </span>
            </div>

            <div className="progress-line">
              <span
                style={{
                  width: `${userBudget > 0 ? Math.min(100, Math.round((totalSpent / userBudget) * 100)) : 0}%`,
                  background: remainingBudget < 0 ? 'var(--red)' : 'var(--accent-strong)'
                }}
              ></span>
            </div>
            <div className="small-muted" style={{ marginTop: '8px' }}>
              {userBudget > 0 ? Math.round((totalSpent / userBudget) * 100) : 0}% {isAr ? 'مستخدمة' : 'utilized'}
            </div>

            {/* Category Sub-Budgets */}
            {['food', 'transport', 'housing', 'leisure'].map((cat) => {
              const catTotal = monthExpenses
                .filter((x) => x.category === cat && x.type !== 'income')
                .reduce((s, x) => s + x.amount, 0);
              const pct = userBudget > 0 ? Math.min(100, Math.round((catTotal / (userBudget / 4)) * 100)) : 0;
              return (
                <div key={cat} className="budget-row">
                  <div className="budget-title">
                    <strong>{categoryLabels[cat] || cat}</strong>
                    <span>${catTotal.toLocaleString()}</span>
                  </div>
                  <div className="progress-line">
                    <span
                      style={{
                        width: `${pct}%`,
                        background: pct > 85 ? 'var(--orange)' : 'var(--accent-strong)'
                      }}
                    ></span>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Savings Goals */}
          <div className="section-head" style={{ marginTop: '20px' }}>
            <div>
              <h2>{isAr ? 'صناديق الادخار والحرية' : 'Savings & Reserve'}</h2>
            </div>
            <button className="btn subtle small" onClick={() => setIsSavingsModalOpen(true)}>
              + {isAr ? 'هدف ادخار' : 'New Goal'}
            </button>
          </div>

          {savingsGoals.length === 0 ? (
            <div className="empty-inline">
              {isAr ? 'لا توجد صناديق ادخار بعد' : 'No savings goals set'}
            </div>
          ) : (
            savingsGoals.map((sg) => {
              const pct = sg.targetAmount > 0 ? Math.min(100, Math.round((sg.currentAmount / sg.targetAmount) * 100)) : 0;
              return (
                <section key={sg.id} className="panel savings-card">
                  <div className="savings-head">
                    <div>
                      <strong>{sg.title}</strong>
                      <small>${sg.currentAmount.toLocaleString()} / ${sg.targetAmount.toLocaleString()}</small>
                    </div>
                    <span className="savings-value">{pct}%</span>
                  </div>

                  <div className="progress-line" style={{ margin: '13px 0' }}>
                    <span style={{ width: `${pct}%` }}></span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      className="btn small subtle"
                      onClick={() => updateSavingsGoal(sg.id, 50)}
                    >
                      + $50 {isAr ? 'إيداع' : 'Add'}
                    </button>
                  </div>
                </section>
              );
            })
          )}
        </aside>
      </div>

      {/* Transaction Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{isAr ? 'تسجيل معاملة مالية' : 'Record Transaction'}</h2>
                <p>{isAr ? 'سجل نفقاتك أو دخلك بسرعة للحفاظ على وعي مالي مستمر.' : 'Conscious tracking creates financial calm.'}</p>
              </div>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div className="field">
                <label>{isAr ? 'الوصف' : 'Description'} *</label>
                <input
                  className="input"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={isAr ? 'مثال: مشتريات البقالة، اشتراك إنترنت...' : 'e.g. Groceries, Cloud Server...'}
                  autoFocus
                  required
                />
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>{isAr ? 'المبلغ ($)' : 'Amount ($)'} *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="45.00"
                    required
                  />
                </div>

                <div className="field">
                  <label>{isAr ? 'النوع' : 'Type'}</label>
                  <select
                    className="select"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                  >
                    <option value="expense">{isAr ? 'مصروف (إنفاق)' : 'Expense'}</option>
                    <option value="income">{isAr ? 'دخل (وارد)' : 'Income'}</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label>{isAr ? 'التصنيف' : 'Category'}</label>
                <select
                  className="select"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                >
                  <option value="food">{isAr ? 'طعام وغذاء' : 'Food & Dining'}</option>
                  <option value="transport">{isAr ? 'مواصلات وتنقل' : 'Transport'}</option>
                  <option value="housing">{isAr ? 'سكن وفواتير' : 'Housing & Utilities'}</option>
                  <option value="tech">{isAr ? 'أدوات وتقنية' : 'Tech & Subscriptions'}</option>
                  <option value="leisure">{isAr ? 'ترفيه' : 'Leisure'}</option>
                  <option value="health">{isAr ? 'صحة' : 'Health'}</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="button" className="btn subtle" onClick={() => setIsModalOpen(false)}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="btn primary">
                  {isAr ? 'حفظ المعاملة ✓' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Savings Modal */}
      {isSavingsModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsSavingsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{isAr ? 'صندوق ادخار جديد' : 'New Savings Goal'}</h2>
                <p>{isAr ? 'حدد هدفاً مالياً مشجعاً للادخار بانتظام.' : 'Define a milestone to build peace of mind.'}</p>
              </div>
              <button className="modal-close" onClick={() => setIsSavingsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleCreateSaving} className="space-y-4">
              <div className="field">
                <label>{isAr ? 'اسم الهدف' : 'Goal Name'} *</label>
                <input
                  className="input"
                  value={savingName}
                  onChange={(e) => setSavingName(e.target.value)}
                  placeholder={isAr ? 'مثال: صندوق الطوارئ، سفرة الصيف...' : 'e.g. Emergency Fund, Travel...'}
                  required
                />
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>{isAr ? 'المبلغ المستهدف ($)' : 'Target Amount ($)'}</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={savingTarget}
                    onChange={(e) => setSavingTarget(Number(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label>{isAr ? 'المبلغ الحالي ($)' : 'Initial Balance ($)'}</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={savingInitial}
                    onChange={(e) => setSavingInitial(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn subtle" onClick={() => setIsSavingsModalOpen(false)}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="btn primary">
                  {isAr ? 'إنشاء الصندوق' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Budget Limit Modal */}
      {isBudgetModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsBudgetModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{isAr ? 'تعديل سقف الميزانية الشهرية' : 'Monthly Budget Cap'}</h2>
                <p>{isAr ? 'حدد السقف الأقصى للإنفاق الشهري لمراقبة الفائض.' : 'Keep yourself anchored with a healthy boundary.'}</p>
              </div>
              <button className="modal-close" onClick={() => setIsBudgetModalOpen(false)}>×</button>
            </div>
            <div className="space-y-4">
              <div className="field">
                <label>{isAr ? 'الميزانية الشهرية ($)' : 'Monthly Budget ($)'}</label>
                <input
                  type="number"
                  min="100"
                  step="50"
                  className="input"
                  value={userBudget}
                  onChange={(e) => setUserBudget(Number(e.target.value))}
                />
              </div>
              <div className="form-actions">
                <button className="btn primary" onClick={() => setIsBudgetModalOpen(false)}>
                  {isAr ? 'تأكيد الحفظ ✓' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

