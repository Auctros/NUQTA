import { localDateKey } from '../lib/dateKey';
import React, { useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { ExpenseRecord } from '../types';
import { NuqtaIcon, IconName } from './NuqtaIcon';
import { NuqtaSelect } from './ui';
import { useEscapeKey } from '../lib/useEscapeKey';

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
  useEscapeKey(isModalOpen, () => setIsModalOpen(false));
  const [isSavingsFormOpen, setIsSavingsFormOpen] = useState(false);
  const [isBudgetEditing, setIsBudgetEditing] = useState(false);
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
  // Default a new fund to a six-month horizon, but let the user pick the date.
  const [savingTargetDate, setSavingTargetDate] = useState(() =>
    localDateKey(new Date(Date.now() + 180 * 86400000))
  );

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

  const categoryIcons: Record<string, IconName> = {
    food: 'coffee',
    transport: 'compass',
    housing: 'grid',
    tech: 'layers',
    leisure: 'sparkle',
    health: 'activity',
    savings: 'wallet'
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
    // A fund with a non-positive target can never be reached; refuse to save it.
    const target = Number(savingTarget);
    if (!Number.isFinite(target) || target <= 0) return;

    addSavingsGoal({
      title: savingName.trim(),
      targetAmount: target,
      currentAmount: Math.max(0, Number(savingInitial) || 0),
      targetDate: savingTargetDate || undefined
    });

    setSavingName('');
    setSavingTarget(1000);
    setSavingInitial(0);
    setSavingTargetDate(localDateKey(new Date(Date.now() + 180 * 86400000)));
    setIsSavingsFormOpen(false);
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
                      <NuqtaIcon
                        name={isInc ? 'arrow' : categoryIcons[entry.category] || 'wallet'}
                        className="w-3.5 h-3.5"
                      />
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
              <div className="flex items-center gap-2">
                <span className={`tag ${remainingBudget < 0 ? 'red' : 'green'}`}>
                  {remainingBudget < 0 ? '−' : '+'}${Math.abs(remainingBudget).toLocaleString()}
                </span>
                <button
                  type="button"
                  className="mini-icon"
                  aria-expanded={isBudgetEditing}
                  aria-controls="budget-inline-edit"
                  aria-label={isAr ? 'تعديل الميزانية' : 'Edit budget'}
                  onClick={() => setIsBudgetEditing((v) => !v)}
                >
                  <NuqtaIcon name="edit" className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {isBudgetEditing && (
              <div id="budget-inline-edit" className="field" style={{ marginBottom: '13px' }}>
                <label htmlFor="budget-inline-input">
                  {isAr ? 'الميزانية الشهرية ($)' : 'Monthly Budget ($)'}
                </label>
                <input
                  id="budget-inline-input"
                  type="number"
                  min="100"
                  step="50"
                  className="input"
                  value={userBudget}
                  autoFocus
                  onChange={(e) => setUserBudget(Number(e.target.value))}
                  onBlur={() => setIsBudgetEditing(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setIsBudgetEditing(false);
                  }}
                />
              </div>
            )}

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
            <button
              className="btn subtle small"
              aria-expanded={isSavingsFormOpen}
              aria-controls="savings-inline-form"
              onClick={() => setIsSavingsFormOpen((v) => !v)}
            >
              {isSavingsFormOpen ? (isAr ? 'إغلاق' : 'Close') : `+ ${isAr ? 'هدف ادخار' : 'New Goal'}`}
            </button>
          </div>

          {isSavingsFormOpen && (
            <form
              id="savings-inline-form"
              onSubmit={handleCreateSaving}
              className="panel panel-pad"
              style={{ marginBottom: '13px' }}
            >
              <div className="field">
                <label htmlFor="saving-name">{isAr ? 'اسم الهدف' : 'Goal Name'} *</label>
                <input
                  id="saving-name"
                  className="input"
                  value={savingName}
                  onChange={(e) => setSavingName(e.target.value)}
                  placeholder={isAr ? 'مثال: صندوق الطوارئ، سفرة الصيف...' : 'e.g. Emergency Fund, Travel...'}
                  autoFocus
                  required
                />
              </div>

              <div className="form-grid" style={{ marginTop: '13px' }}>
                <div className="field">
                  <label htmlFor="saving-target">{isAr ? 'المبلغ المستهدف ($)' : 'Target Amount ($)'} *</label>
                  <input
                    id="saving-target"
                    type="number"
                    inputMode="decimal"
                    min="1"
                    step="50"
                    required
                    className="input"
                    value={savingTarget}
                    onChange={(e) => setSavingTarget(Number(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="saving-initial">{isAr ? 'المبلغ الحالي ($)' : 'Initial Balance ($)'}</label>
                  <input
                    id="saving-initial"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="50"
                    className="input"
                    value={savingInitial}
                    onChange={(e) => setSavingInitial(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="field" style={{ marginTop: '13px' }}>
                <label htmlFor="saving-target-date">{isAr ? 'التاريخ المستهدف' : 'Target Date'}</label>
                <input
                  id="saving-target-date"
                  type="date"
                  className="input"
                  value={savingTargetDate}
                  onChange={(e) => setSavingTargetDate(e.target.value)}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn subtle" onClick={() => setIsSavingsFormOpen(false)}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="btn primary">
                  {isAr ? 'إنشاء الصندوق' : 'Create Fund'}
                </button>
              </div>
            </form>
          )}

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
                      {sg.targetDate && (
                        <small>
                          {isAr ? 'الموعد المستهدف:' : 'Target:'} {sg.targetDate}
                        </small>
                      )}
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
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
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
                  <NuqtaSelect value={formType} onChange={(e) => setFormType(e.target.value as any)}>
                    <option value="expense">{isAr ? 'مصروف (إنفاق)' : 'Expense'}</option>
                    <option value="income">{isAr ? 'دخل (وارد)' : 'Income'}</option>
                  </NuqtaSelect>
                </div>
              </div>

              <div className="field">
                <label>{isAr ? 'التصنيف' : 'Category'}</label>
                <NuqtaSelect value={formCategory} onChange={(e) => setFormCategory(e.target.value as any)}>
                  <option value="food">{isAr ? 'طعام وغذاء' : 'Food & Dining'}</option>
                  <option value="transport">{isAr ? 'مواصلات وتنقل' : 'Transport'}</option>
                  <option value="housing">{isAr ? 'سكن وفواتير' : 'Housing & Utilities'}</option>
                  <option value="tech">{isAr ? 'أدوات وتقنية' : 'Tech & Subscriptions'}</option>
                  <option value="leisure">{isAr ? 'ترفيه' : 'Leisure'}</option>
                  <option value="health">{isAr ? 'صحة' : 'Health'}</option>
                </NuqtaSelect>
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

    </div>
  );
};

