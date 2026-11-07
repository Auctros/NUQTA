import React, { useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import {
  Download,
  Upload,
  Shield,
  Key,
  Globe,
  Palette,
  User,
  Award,
  Sparkles,
  Lock,
  FileText,
  Check
} from 'lucide-react';
import { NuqtaStorageEngine } from '../lib/storage';

export const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose
}) => {
  const { profile, setLanguage, setTheme, updateProfileName } = useNuqtaStore();
  const [nameInput, setNameInput] = useState(profile.name);
  const [importStatus, setImportStatus] = useState<string>('');

  if (!isOpen) return null;

  const isAr = profile.language === 'ar';

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(NuqtaStorageEngine.exportFullBackup());
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `nuqta_vault_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = NuqtaStorageEngine.importBackup(content);
      if (success) {
        setImportStatus('Backup restored successfully! Refreshing...');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setImportStatus('Invalid JSON backup file.');
      }
    };
    reader.readAsText(file);
  };

  const handleSaveName = () => {
    if (nameInput.trim()) {
      updateProfileName(nameInput.trim());
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-xl rounded-3xl border border-stone-800 bg-[#161614] p-6 sm:p-8 shadow-2xl text-stone-200 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isAr ? 'إعدادات المنظومة والخصوصية' : 'System Settings & Privacy Vault'}
              </h2>
              <p className="text-xs text-stone-400">
                {isAr ? 'بياناتك ملكك تماماً: حفظ محلي، لا إعلانات، لا تعقب' : 'Local-first architecture with zero telemetry and total data portability'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* User Identity & Level */}
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider">
            {isAr ? 'الملف الشخصي والمستوى' : 'Personal Identity & Level'}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your name"
              className="flex-1 rounded-xl border border-stone-800 bg-stone-900 px-3.5 py-2 text-xs text-white outline-none focus:border-amber-400"
            />
            <button
              onClick={handleSaveName}
              className="px-4 py-2 rounded-xl bg-stone-800 text-xs font-semibold text-stone-200 hover:bg-stone-700"
            >
              {isAr ? 'حفظ' : 'Update'}
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
            <Award className="w-4 h-4" />
            <span>
              Level {profile.level} Master Architect • {profile.experiencePoints} XP Accumulated
            </span>
          </div>
        </div>

        {/* Language & Theme */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-stone-800">
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-2">Language / اللغة</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setLanguage('en')}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                  profile.language === 'en'
                    ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                    : 'border-stone-800 bg-stone-900 text-stone-400'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('ar')}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                  profile.language === 'ar'
                    ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                    : 'border-stone-800 bg-stone-900 text-stone-400'
                }`}
              >
                العربية
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-2">Theme Aesthetic</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTheme('dark')}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                  profile.theme === 'dark'
                    ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                    : 'border-stone-800 bg-stone-900 text-stone-400'
                }`}
              >
                Dark Warm
              </button>
              <button
                onClick={() => setTheme('midnight-gold')}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                  profile.theme === 'midnight-gold'
                    ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                    : 'border-stone-800 bg-stone-900 text-stone-400'
                }`}
              >
                Midnight Gold
              </button>
            </div>
          </div>
        </div>

        {/* Data Portability (Export & Import) */}
        <div className="pt-2 border-t border-stone-800 space-y-3">
          <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider">
            {isAr ? 'تصدير واستيراد البيانات (Zero Lock-in)' : 'Zero Lock-in: Data Portability'}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleExportJSON}
              className="py-3 px-4 rounded-xl border border-stone-800 bg-stone-900 text-stone-200 text-xs font-medium hover:border-amber-400 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>{isAr ? 'تصدير نسخة كاملة (JSON)' : 'Export Full Vault (JSON)'}</span>
            </button>

            <label className="py-3 px-4 rounded-xl border border-stone-800 bg-stone-900 text-stone-200 text-xs font-medium hover:border-amber-400 transition-all flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? 'استيراد نسخة سابقة' : 'Import Backup'}</span>
              <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </label>
          </div>
          {importStatus && (
            <p className="text-xs text-amber-400 font-mono text-center">{importStatus}</p>
          )}
        </div>

        {/* Close Button */}
        <div className="pt-4 border-t border-stone-800">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-amber-400 text-stone-950 font-bold text-xs hover:bg-amber-300 transition-all"
          >
            {isAr ? 'إغلاق الإعدادات' : 'Close Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};
