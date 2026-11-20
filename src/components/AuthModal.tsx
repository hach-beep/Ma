import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Car, Eye, EyeOff, KeyRound, Lock, LogIn, ShieldCheck, X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  user: User | null;
  initialRole?: 'driver' | 'staff';
  authError: string | null;
  onClose: () => void;
  onDriverContinue: () => Promise<void>;
  onStaffContinue: (staffCode: string) => Promise<boolean>;
  onClearError: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  user,
  initialRole = 'driver',
  authError,
  onClose,
  onDriverContinue,
  onStaffContinue,
  onClearError,
}) => {
  const [accountType, setAccountType] = useState<'driver' | 'staff'>(initialRole);
  const [staffCode, setStaffCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setAccountType(initialRole);
      setLocalError(null);
      setStaffCode('');
    }
  }, [isOpen, initialRole]);

  if (!isOpen) return null;

  const displayError = localError || authError;

  const handleDriverSubmit = async () => {
    setLocalError(null);
    onClearError();
    setSubmitting(true);
    try {
      await onDriverContinue();
    } finally {
      setSubmitting(false);
    }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    onClearError();

    const trimmed = staffCode.trim();
    if (!trimmed) {
      setLocalError('يرجى إدخال رمز الموظف للمتابعة.');
      return;
    }
    if (trimmed !== '55555') {
      setLocalError(
        'رمز الموظف غير صحيح. يجب إدخال الرمز الصحيح لإنشاء حساب موظف أو الدخول للوحة الموظف.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const ok = await onStaffContinue(trimmed);
      if (!ok) {
        setLocalError('تعذر تفعيل حساب الموظف. تأكد من إتمام تسجيل الدخول.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-l from-[#0B1C3E] to-[#1D4ED8] text-white px-6 py-5 flex items-center justify-between">
          <div>
            <h2 id="auth-modal-title" className="text-lg font-bold">
              {user ? 'اختيار نوع الحساب' : 'إنشاء حساب / تسجيل دخول'}
            </h2>
            <p className="text-xs text-blue-100 mt-0.5">
              {user
                ? `الحساب الحالي: ${user.email}`
                : 'اختر نوع الحساب للمتابعة في تطبيق محطتي'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Account Type Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setAccountType('driver');
                setLocalError(null);
                onClearError();
              }}
              className={`p-3.5 rounded-2xl border text-right transition-colors ${
                accountType === 'driver'
                  ? 'bg-[#EEF4FF] border-[#2563EB] text-[#132B5E]'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <Car className="w-5 h-5 mb-2" />
              <div className="text-sm font-bold">حساب سائق</div>
              <div className="text-[11px] opacity-80 mt-0.5">
                حجز الدور ومتابعة الطابور
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setAccountType('staff');
                setLocalError(null);
                onClearError();
              }}
              className={`p-3.5 rounded-2xl border text-right transition-colors ${
                accountType === 'staff'
                  ? 'bg-[#EEF4FF] border-[#2563EB] text-[#132B5E]'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <ShieldCheck className="w-5 h-5 mb-2" />
              <div className="text-sm font-bold">حساب موظف</div>
              <div className="text-[11px] opacity-80 mt-0.5">
                إدارة المحطة (يتطلب كود)
              </div>
            </button>
          </div>

          {displayError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-semibold text-red-700 leading-relaxed">
              {displayError}
            </div>
          )}

          {accountType === 'driver' ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                بصفتك سائقاً، يمكنك تصفح المحطات القريبة ومعرفة وقت الانتظار وحجز دورك إلكترونياً مباشرة.
              </p>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDriverSubmit}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#132B5E] text-white text-sm font-bold hover:bg-[#1D3E85] disabled:opacity-50 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'جاري تسجيل الدخول...'
                    : user
                    ? 'المتابعة كحساب سائق'
                    : 'تسجيل الدخول / إنشاء حساب سائق (Google)'}
                </span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleStaffSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="staff-secret-code"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  كود تفعيل حساب الموظف
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="staff-secret-code"
                    type={showCode ? 'text' : 'password'}
                    inputMode="numeric"
                    autoComplete="off"
                    value={staffCode}
                    onChange={(e) => setStaffCode(e.target.value)}
                    placeholder="أدخل كود الموظف المطلوب"
                    className="w-full min-h-[46px] pr-10 pl-10 py-2 rounded-xl border border-slate-200 text-sm font-mono-num text-slate-900 focus:outline-none focus:border-[#2563EB]"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCode((v) => !v)}
                    aria-label={showCode ? 'إخفاء الكود' : 'إظهار الكود'}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700"
                  >
                    {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  سواء كان لديك حساب سائق سابق أم حساب جديد، إدخال الكود الصحيح يفعّل لك لوحة الموظف فوراً.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#132B5E] text-white text-sm font-bold hover:bg-[#1D3E85] disabled:opacity-50 transition-colors"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'جاري التحقق والتسجيل...'
                    : user
                    ? 'تحقق وفتح لوحة الموظف'
                    : 'تحقق وإنشاء / دخول حساب موظف (Google)'}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
