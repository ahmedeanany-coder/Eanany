/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot,
  writeBatch,
  updateDoc,
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

import { 
  Wallet, 
  TrendingUp, 
  Calendar, 
  Coins, 
  LogOut, 
  FileSpreadsheet,
  LogIn, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Save,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Calculator,
  Download,
  Users,
  Target,
  Goal,
  MinusCircle,
  PlusCircle,
  Flame,
  ArrowUpRight,
  TrendingDown,
  Dna,
  LayoutDashboard,
  Box,
  Circle,
  RotateCcw,
  DollarSign,
  Car,
  ShieldAlert,
  CircleDollarSign,
  Siren,
  Eye,
  EyeOff,
  Sparkles,
  Send,
  MessageSquare,
  BrainCircuit,
  Bot,
  Fingerprint,
  Lock,
  Unlock,
  Mail,
  KeyRound,
  RefreshCw,
  RefreshCcw,
  SkipForward,
  SkipBack,
  Play,
  X,
  Trash2,
  Settings,
  Languages,
  Palette,
  Zap,
  MessageCircle,
  ArrowRight,
  Home,
  Utensils,
  ShoppingBag,
  Activity,
  PlayCircle,
  LayoutGrid,
  PieChart as LucidePieChart,
  Receipt,
  Menu,
  BarChart3
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Label
} from 'recharts';
import Markdown from 'react-markdown';
import { auth, db, login, logout, OperationType, handleFirestoreError } from './lib/firebase';
import { INITIAL_PLAN } from './lib/savingsData';
import { MonthlyEntry, UserProfile, ExpenseItem, GoldTransaction } from './types';
import { cn } from './lib/utils';
import { getFinancialAdvice, askFinancialAI, getGoldPrice } from './services/aiService';
import { exportPlanToExcel } from './lib/exportUtils';
import FileConverter from './components/FileConverter';

const AUTHORIZED_EMAIL = 'ahmedeanany@gmail.com';

const EXPENSE_CATEGORIES: { id: string; label: string; labelEn: string; icon: any; color: string }[] = [
  { id: 'home', label: 'منزل/إيجار', labelEn: 'Home/Rent', icon: Home, color: '#f43f5e' },
  { id: 'food', label: 'طعام/بقالة', labelEn: 'Food/Groceries', icon: Utensils, color: '#fb923c' },
  { id: 'transport', label: 'انتقالات', labelEn: 'Transport', icon: Car, color: '#38bdf8' },
  { id: 'utilities', label: 'فواتير/خدمات', labelEn: 'Utilities', icon: Zap, color: '#facc15' },
  { id: 'health', label: 'صحة', labelEn: 'Health', icon: Activity, color: '#4ade80' },
  { id: 'shopping', label: 'تسوق', labelEn: 'Shopping', icon: ShoppingBag, color: '#c084fc' },
  { id: 'entertainment', label: 'ترفيه', labelEn: 'Entertainment', icon: PlayCircle, color: '#f472b6' },
  { id: 'other', label: 'أخرى', labelEn: 'Other', icon: LayoutGrid, color: '#94a3b8' }
];

const CATEGORY_COLORS = ['#ffffff', '#71717a', '#3f3f46', '#27272a', '#a1a1aa', '#52525b', '#18181b', '#d4d4d8'];

const THEME_IDS = ['royal', 'light', 'midnight', 'nebula', 'mint', 'lava', 'aurora', 'coffee', 'slate'];

const DEFAULT_PROFILE: UserProfile = {
  goldPrice: 8000,
  targetCash: 359300,
  targetGold: 44.91,
  userName: 'أحمد',
  emergencyFund: 1200,
  dailyBalance: 0,
  startDate: '2026-04-01',
  endDate: '2028-06-30',
  masterPassword: '3Nany'
};

const getAutoCategory = (description: string, existingCategory: string | undefined) => {
  if (existingCategory && existingCategory !== 'other') return existingCategory;
  const desc = (description || '').toLowerCase();
  
  // Home & Rent
  if (desc.includes('بيت') || desc.includes('إيجار') || desc.includes('home') || desc.includes('rent') || desc.includes('سكن') || desc.includes('توضيب') || desc.includes('عفش')) return 'home';
  
  // Food & Groceries
  if (desc.includes('أكل') || desc.includes('طعام') || desc.includes('food') || desc.includes('بقالة') || desc.includes('grocery') || desc.includes('سوبر') || desc.includes('خضار') || desc.includes('فاكهة') || desc.includes('لحمة') || desc.includes('فراخ') || desc.includes('عيش') || desc.includes('لبن') || desc.includes('جبنة') || desc.includes('مطعم') || desc.includes('دليفري') || desc.includes('order') || desc.includes('طلب')) return 'food';
  
  // Transport
  if (desc.includes('أوبر') || desc.includes('uber') || desc.includes('انتقالات') || desc.includes('transport') || desc.includes('bus') || desc.includes('مترو') || desc.includes('ميكروباص') || desc.includes('بنزين') || desc.includes('غاز') || desc.includes('زيت') || desc.includes('كاوتش') || desc.includes('عربية') || desc.includes('تصليح') || desc.includes('توصيل') || desc.includes('مشوار')) return 'transport';
  
  // Utilities
  if (desc.includes('كهرباء') || desc.includes('مياه') || desc.includes('غاز') || desc.includes('utility') || desc.includes('bill') || desc.includes('فاتورة') || desc.includes('شحن') || desc.includes('كارت') || desc.includes('رصيد') || desc.includes('انترنت') || desc.includes('نت') || desc.includes('وي') || desc.includes('اتصالات') || desc.includes('فودافون') || desc.includes('اورانج')) return 'utilities';
  
  // Health
  if (desc.includes('دواء') || desc.includes('صيدلية') || desc.includes('كشف') || desc.includes('health') || desc.includes('medical') || desc.includes('طبيب') || desc.includes('دكتور') || desc.includes('مستشفى') || desc.includes('تحليل') || desc.includes('اشعة') || desc.includes('علاج')) return 'health';
  
  // Shopping
  if (desc.includes('لبس') || desc.includes('هدوم') || desc.includes('shopping') || desc.includes('clothes') || desc.includes('قميص') || desc.includes('بنطلون') || desc.includes('كوتشي') || desc.includes('جزمة') || desc.includes('براند') || desc.includes('محل') || desc.includes('امازون') || desc.includes('نون')) return 'shopping';
  
  // Entertainment
  if (desc.includes('خروجة') || desc.includes('فسحة') || desc.includes('سينما') || desc.includes('entertainment') || desc.includes('نادي') || desc.includes('جيم') || desc.includes('gym') || desc.includes('اشتراك') || desc.includes('سهر') || desc.includes('سفر')) return 'entertainment';
  
  return 'other';
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBiometricVerified, setIsBiometricVerified] = useState(true);
  const [password, setPassword] = useState('');
  const [currentProject, setCurrentProject] = useState<'savings' | 'daily' | 'expenses' | 'settings' | 'gold' | 'stats' | 'ai' | 'converter'>('savings');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [theme, setTheme] = useState<'royal' | 'light' | 'midnight' | 'nebula' | 'mint' | 'lava' | 'aurora' | 'coffee' | 'slate'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('app-theme') as any) || 'royal';
    }
    return 'royal';
  });
  
  // Theme Helper
  const isDark = useMemo(() => theme !== 'light' && theme !== 'slate' && theme !== 'coffee', [theme]);

  const [resetState, setResetState] = useState<{
    step: 'none' | 'otp' | 'new-password';
    otp: string;
    otpInput: string;
    newPass: string;
  }>({ step: 'none', otp: '', otpInput: '', newPass: '' });
  const [bioError, setBioError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entries, setEntries] = useState<MonthlyEntry[]>([]);
  const [goldLogs, setGoldLogs] = useState<GoldTransaction[]>([]);
  const [currentGoldPrice, setCurrentGoldPrice] = useState(7900);
  const [isRefreshingGold, setIsRefreshingGold] = useState(false);
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [editTargetCash, setEditTargetCash] = useState<string>('');
  const [editTargetGold, setEditTargetGold] = useState<string>('');

  
  // Update Theme Body Class
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const themes: Record<string, { bg: string, text: string, card: string, border: string, primary: string }> = {
        royal: { bg: '#000000', text: '#ffffff', card: '#0a0a0c', border: 'rgba(212, 175, 55, 0.15)', primary: '#d4af37' },
        light: { bg: '#ffffff', text: '#0f172a', card: '#f8fafc', border: '#e2e8f0', primary: '#0f172a' },
        midnight: { bg: '#020617', text: '#f1f5f9', card: '#0f172a', border: 'rgba(59, 130, 246, 0.1)', primary: '#3b82f6' },
        nebula: { bg: '#0f0114', text: '#faf5ff', card: '#1a0221', border: 'rgba(217, 70, 239, 0.15)', primary: '#d946ef' },
        mint: { bg: '#050f0d', text: '#f0fdf4', card: '#0a1a16', border: 'rgba(16, 185, 129, 0.1)', primary: '#10b981' },
        lava: { bg: '#0c0c0c', text: '#fff7ed', card: '#1a1a1a', border: 'rgba(249, 115, 22, 0.15)', primary: '#f97316' },
        aurora: { bg: '#05191c', text: '#f0fdfa', card: '#0a2a2e', border: 'rgba(45, 212, 191, 0.15)', primary: '#2dd4bf' },
        coffee: { bg: '#fdfaf6', text: '#431407', card: '#ffffff', border: '#f3e8df', primary: '#b45309' },
        slate: { bg: '#f8fafc', text: '#1e293b', card: '#ffffff', border: '#e2e8f0', primary: '#64748b' }
      };

      const selectedTheme = themes[theme] || themes.royal;
      const root = document.documentElement;
      
      document.body.style.backgroundColor = selectedTheme.bg;
      document.body.style.color = selectedTheme.text;
      
      // Update CSS variables
      root.style.setProperty('--brand-bg', selectedTheme.bg);
      root.style.setProperty('--brand-card', selectedTheme.card);
      root.style.setProperty('--brand-border', selectedTheme.border);
      root.style.setProperty('--brand-yellow', selectedTheme.primary);
      root.style.setProperty('--brand-primary', selectedTheme.primary);
      
      // Update global classes
      root.classList.remove('royal', 'light', 'midnight', 'nebula', 'mint', 'lava', 'aurora', 'coffee', 'slate');
      root.classList.add(theme);
      
      const themeIsDark = theme !== 'light' && theme !== 'slate' && theme !== 'coffee';
      if (themeIsDark) {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }
      
      localStorage.setItem('app-theme', theme);
    }
  }, [theme]);

  // Haptic feedback helper
  const vibrate = useCallback((pattern: number | number[] = 10) => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(pattern);
    }
  }, []);

  // Track selected month for Expense Tracker
  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(null);

  // Interaction States
  const [language, setLanguage] = useState<'ar' | 'en'>('en');
  const [editingField, setEditingField] = useState<{ field: string; label: string } | null>(null);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isAddingGoldLog, setIsAddingGoldLog] = useState(false);
  const [tempValue, setTempValue] = useState<string>('');
  const [editValue, setEditValue] = useState<string>('');
  const [newExpense, setNewExpense] = useState({ 
    description: '', 
    amount: '', 
    category: 'other', 
    customCategory: '',
    isInstallment: false, 
    installmentStartId: '', 
    installmentEndId: '' 
  });
  const [newGoldLog, setNewGoldLog] = useState({ weight: '', price: '', notes: '' });

  const handleAddGoldLog = async () => {
    if (!user) return;
    try {
      const goldLogsRef = collection(db, 'profiles', user.uid, 'goldLogs');
      const weight = Number(newGoldLog.weight);
      const price = Number(newGoldLog.price) || currentGoldPrice;
      
      await addDoc(goldLogsRef, {
        weight,
        price,
        notes: newGoldLog.notes,
        date: new Date().toISOString()
      });
      
      setIsAddingGoldLog(false);
      setNewGoldLog({ weight: '', price: '', notes: '' });
      vibrate(20);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'goldLogs/add');
    }
  };
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [showValues, setShowValues] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [isSmartLoading, setIsSmartLoading] = useState(false);
  const [smartInput, setSmartInput] = useState('');
  const [goldWeightInput, setGoldWeightInput] = useState<string>('');
  const [dailyInput, setDailyInput] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [isEditingUber, setIsEditingUber] = useState(false);
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [isEditingEmergency, setIsEditingEmergency] = useState(false);

  // Update Handlers
  const handleUpdateField = async () => {
    if (!user || !editingField) return;
    try {
      const val = Number(editValue);
      if (editingField.field === 'savingsTarget' || editingField.field === 'emergencyFund') {
        const profileRef = doc(db, 'profiles', user.uid);
        await updateDoc(profileRef, { [editingField.field]: val });
      } else if (selectedMonthId) {
        const entryRef = doc(db, 'profiles', user.uid, 'entries', selectedMonthId);
        const map: Record<string, string> = {
          salary: 'actualSalary',
          uberIncome: 'actualUber',
          savings: 'currentSavings' // We'll handle this specially if needed, but for now we assume it's calculated
        };
        const fieldName = map[editingField.field] || editingField.field;
        await updateDoc(entryRef, { [fieldName]: val });
      }
      setEditingField(null);
      setEditValue('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `field/${editingField.field}`);
    }
  };

  const handleUpdateUber = async () => {
    if (!user || !selectedEntry || !selectedMonthId) return;
    try {
      const entryRef = doc(db, 'profiles', user.uid, 'entries', selectedMonthId);
      await updateDoc(entryRef, { actualUber: Number(tempValue) });
      setIsEditingUber(false);
      setTempValue('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'uber');
    }
  };

  const handleUpdateSalary = async () => {
    if (!user || !selectedEntry || !selectedMonthId) return;
    try {
      const entryRef = doc(db, 'profiles', user.uid, 'entries', selectedMonthId);
      await updateDoc(entryRef, { actualSalary: Number(tempValue) });
      setIsEditingSalary(false);
      setTempValue('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'salary');
    }
  };

  const handleUpdateEmergency = async () => {
    if (!user || !profile) return;
    try {
      const profileRef = doc(db, 'profiles', user.uid);
      await updateDoc(profileRef, { emergencyFund: Number(tempValue) });
      setIsEditingEmergency(false);
      setTempValue('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'emergency');
    }
  };

  const handleQuickUpdate = async (type: 'salary' | 'uber' | 'savings' | 'emergency', amount?: number) => {
    if (!user || !profile || !selectedMonthId || !selectedEntry) return;
    const finalAmount = amount !== undefined ? amount : Number(quickAmount);
    if (isNaN(finalAmount)) return;

    try {
      const entryRef = doc(db, 'profiles', user.uid, 'entries', selectedMonthId);
      const profileRef = doc(db, 'profiles', user.uid);
      
      if (type === 'salary') {
        await updateDoc(entryRef, { actualSalary: (selectedEntry.actualSalary || 0) + finalAmount });
      } else if (type === 'uber') {
        await updateDoc(entryRef, { actualUber: (selectedEntry.actualUber || 0) + finalAmount });
      } else if (type === 'emergency') {
        await updateDoc(profileRef, { emergencyFund: (profile.emergencyFund || 0) + finalAmount });
      }
      
      setQuickAmount('');
      vibrate(20);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `quick/${type}`);
    }
  };

  const exportData = () => {
    if (!selectedEntry) return;
    const exportBundle = {
      profile: profile,
      currentMonth: selectedEntry,
      allEntries: entries,
      exportDate: new Date().toISOString()
    };
    const dataStr = JSON.stringify(exportBundle, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `masroofy-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    vibrate(20);
  };

  const handleAddExpense = async () => {
    if (!user || !selectedMonthId || !selectedEntry) return;
    const amount = Number(newExpense.amount);
    if (isNaN(amount) || amount <= 0 || !newExpense.description) return;

    // Use auto category if it's 'other', unless user provided a custom category
    let finalCategory = newExpense.category;
    if (finalCategory === 'other') {
      if (newExpense.customCategory) {
        finalCategory = newExpense.customCategory;
      } else {
        finalCategory = getAutoCategory(newExpense.description, undefined);
      }
    }

    try {
      const { arrayUnion } = await import('firebase/firestore');
      
      if (newExpense.isInstallment && newExpense.installmentEndId) {
        const batch = writeBatch(db);
        const recurringId = crypto.randomUUID();
        
        const startId = newExpense.installmentStartId || selectedMonthId;
        
        // Find all entries between startId and installmentEndId
        const startIndex = entries.findIndex(e => e.id === startId);
        const endIndex = entries.findIndex(e => e.id === newExpense.installmentEndId);
        
        if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
          for (let i = startIndex; i <= endIndex; i++) {
            const entry = entries[i];
            const entryRef = doc(db, 'profiles', user.uid, 'entries', entry.id);
            
            batch.update(entryRef, {
              expenses: arrayUnion({
                id: crypto.randomUUID(),
                recurringId: recurringId,
                description: newExpense.description,
                amount: amount,
                category: finalCategory,
                installmentInfo: {
                  current: i - startIndex + 1,
                  total: endIndex - startIndex + 1
                }
              })
            });
          }
          await batch.commit();
        }
      } else {
        const entryRef = doc(db, 'profiles', user.uid, 'entries', selectedMonthId);
        await updateDoc(entryRef, {
          expenses: arrayUnion({
            id: crypto.randomUUID(),
            description: newExpense.description,
            amount: amount,
            category: finalCategory
          })
        });
      }
      
      setIsAddingExpense(false);
      setNewExpense({ description: '', amount: '', category: 'other', customCategory: '', isInstallment: false, installmentStartId: '', installmentEndId: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `entries/${selectedMonthId}/expenses`);
    }
  };

  const handleDeleteExpense = async (expenseId: string, recurringId?: string) => {
    if (!user || !selectedMonthId || !selectedEntry) return;
    
    try {
      if (recurringId) {
        const choice = window.confirm(
          language === 'ar' 
            ? 'هل تريد حذف جميع الأقساط المرتبطة بهذه المعاملة من جميع الأشهر؟\n(موافق: الكل، إلغاء: هذا الشهر فقط)' 
            : 'Do you want to delete all installments associated with this transaction from all months?\n(OK: All, Cancel: This month only)'
        );

        if (choice) {
          const batch = writeBatch(db);
          let count = 0;
          for (const entry of entries) {
            const hasRecurring = entry.expenses?.some(e => (e as any).recurringId === recurringId);
            if (hasRecurring) {
              const entryRef = doc(db, 'profiles', user.uid, 'entries', entry.id);
              const filtered = entry.expenses.filter(e => (e as any).recurringId !== recurringId);
              batch.update(entryRef, { expenses: filtered });
              count++;
            }
          }
          if (count > 0) await batch.commit();
          return;
        }
      }
      
      const entryRef = doc(db, 'profiles', user.uid, 'entries', selectedMonthId);
      const updatedExpenses = (selectedEntry.expenses || []).filter(e => e.id !== expenseId);
      await updateDoc(entryRef, { expenses: updatedExpenses });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `entries/${selectedMonthId}/expenses`);
    }
  };

  // Keyboard visibility detection
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const handleResize = () => {
      // Hide if viewport height shrinks by more than 15% (keyboard likely open)
      setIsKeyboardVisible(visualViewport.height < window.innerHeight * 0.85);
    };

    visualViewport.addEventListener('resize', handleResize);
    return () => visualViewport.removeEventListener('resize', handleResize);
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    // Connection test to verify Firestore availability
    const testConnection = async () => {
      try {
        const { getDocFromServer } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Firestore is offline. Check your connection.");
        }
      }
    };
    testConnection();
    
    // Auto-fetch Gold Price
    const fetchGoldPrice = async () => {
      try {
        const price = await getGoldPrice();
        if (price > 2000 && price < 15000) { // Safety range check
          setCurrentGoldPrice(price);
          if (user) {
            const profileRef = doc(db, 'profiles', user.uid);
            await updateDoc(profileRef, { goldPrice: price });
          }
        }
      } catch (err) {
        console.error("Gold price fetch failed", err);
      }
    };
    fetchGoldPrice();



    return unsubAuth;
  }, [user]);

  // Data Seeder & Listener
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setEntries([]);
      return;
    }

    const profileRef = doc(db, 'profiles', user.uid);
    const entriesRef = collection(db, 'profiles', user.uid, 'entries');
    
    const unsubProfile = onSnapshot(profileRef, async (snap) => {
      if (!snap.exists()) {
        // Safe Seed only for brand new user
        try {
          const batch = writeBatch(db);
          batch.set(profileRef, DEFAULT_PROFILE);
          
          INITIAL_PLAN.forEach((p, idx) => {
            const monthOffset = (4 + idx - 1) % 12 + 1;
            const yearOffset = p.year + Math.floor((4 + idx - 1) / 12);
            const id = `${yearOffset}-${String(monthOffset).padStart(2, '0')}`;
            
            // Logic: Past months get planned values, Current & Future get 0
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            
            const isPast = yearOffset < currentYear || (yearOffset === currentYear && monthOffset < currentMonth);

            const entryRef = doc(db, 'profiles', user.uid, 'entries', id);
            batch.set(entryRef, {
              year: p.year,
              month: p.month,
              plannedSalary: p.salary,
              plannedUber: p.uber,
              actualSalary: isPast ? p.salary : 0,
              actualUber: isPast ? p.uber : 0,
              expenses: [],
              notes: p.notes,
              order: idx
            });
          });
          
          await batch.commit();
          console.log("Seeded successfully for a new user.");
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'profiles/seed');
        }
      } else {
        const data = snap.data() as UserProfile;
        // Patch missing fields for existing profile legacy compatibility without wiping entries
        if (!data.startDate) {
          try {
            await updateDoc(profileRef, {
              startDate: '2026-04-01',
              endDate: '2028-06-30'
            });
            console.log("Safely patched missing startDate for existing profile.");
          } catch (err) {
            console.error("Error patching startDate:", err);
          }
        }
        setProfile(data);
        setCurrentGoldPrice(data.goldPrice);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'profile');
    });

    const unsubEntries = onSnapshot(entriesRef, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as MonthlyEntry));
      const sorted = docs.sort((a, b) => a.order - b.order);
      setEntries(sorted);
      
      if (sorted.length > 0 && !selectedMonthId) {
        // Find current month index based on real time
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonthName = now.toLocaleDateString('ar-EG', { month: 'long' });
        
        const found = sorted.find(e => e.year === currentYear && e.month.includes(currentMonthName)) || sorted[0];
        if (found) {
          setSelectedMonthId(found.id);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'entries');
    });

    const goldLogsRef = collection(db, 'profiles', user.uid, 'goldLogs');
    const unsubGold = onSnapshot(goldLogsRef, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as GoldTransaction));
      setGoldLogs(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'goldLogs');
    });

    return () => {
      unsubProfile();
      unsubEntries();
      unsubGold();
    };
  }, [user]);

  // Handle OTP steps normally if still used
  const handleStartReset = () => {
    // Explanation: Real emails require an API Key (SendGrid/Mailtrap). 
    // Since the user is logged in via Google as the master owner, we verify identity via session.
    if (user?.email === AUTHORIZED_EMAIL) {
      setResetState({ ...resetState, step: 'new-password' });
    } else {
      setBioError(language === 'ar' ? 'غير مصرح لك بإعادة التعيين' : 'Unauthorized reset attempt');
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    // This step is bypassed for the owner now
  };

  const handleAskAI = async () => {
    if (!chatMessage.trim()) return;
    setIsChatLoading(true);
    setChatResponse(null);
    try {
      const response = await askFinancialAI(chatMessage, { profile, stats }, language);
      setChatResponse(response);
    } catch (err: any) {
      console.error("Ask AI Error:", err);
      let errMsg = "";
      const rawErr = err.message || "";

      if (rawErr.includes('MISSING_API_KEY') || rawErr.includes('API key not valid') || rawErr.includes('Invalid API key')) {
        errMsg = language === 'ar' 
          ? "يوجد مشكلة في مفتاح الوصول للذكاء الاصطناعي." 
          : "AI authentication issue. Please check again.";
      } else if (rawErr.includes('429') || rawErr.includes('RESOURCE_EXHAUSTED') || rawErr.toLowerCase().includes('quota')) {
        errMsg = language === 'ar' 
          ? "الخدمة مشغولة حالياً، يرجى الانتظار دقيقة والمحاولة مرة أخرى." 
          : "Service busy, please wait a minute and try again.";
      } else {
        errMsg = rawErr || 'Error occurred while asking AI.';
      }
      setChatResponse(`⚠️ ${errMsg}`);
    } finally {
      setIsChatLoading(false);
      setChatMessage('');
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !resetState.newPass) return;
    setIsChatLoading(true);
    try {
      const profileRef = doc(db, 'profiles', user.uid);
      await updateDoc(profileRef, { masterPassword: resetState.newPass });
      setResetState({ step: 'none', otp: '', otpInput: '', newPass: '' });
      setIsBiometricVerified(true); // Auto-login after reset
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'password-reset');
    } finally {
      setIsChatLoading(false);
    }
  };

  // Calculations
  const stats = useMemo(() => {
    if (!profile || entries.length === 0) return null;
    
    // Dynamic Month Detection
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthStr = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let currentCashTotal = 0;
    let currentPlannedTotal = 0;
    const computedEntries = entries.map(entry => {
      const actualSalary = Number(entry.actualSalary) || 0;
      const actualUber = Number(entry.actualUber) || 0;
      const expensesTotal = (entry.expenses || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      
      const plannedSalary = Number(entry.plannedSalary) || 0;
      const plannedUber = Number(entry.plannedUber) || 0;
      
      const monthlySavings = (actualSalary + actualUber - expensesTotal);
      currentCashTotal += monthlySavings;
      currentPlannedTotal += (plannedSalary + plannedUber);

      // Category breakdown for this entry
      const categoryTotals = (entry.expenses || []).reduce((acc, curr) => {
        const cat = getAutoCategory(curr.description, curr.category);
        acc[cat] = (acc[cat] || 0) + Number(curr.amount);
        return acc;
      }, {} as Record<string, number>);

      const COLORS = [
        '#f43f5e', '#fb923c', '#38bdf8', '#fbbf24', '#c084fc', '#4ade80', '#2dd4bf', 
        '#f472b6', '#a78bfa', '#fb7185', '#6366f1', '#14b8a6', '#f59e0b', '#ef4444'
      ];

      const expenseChartData = (entry.expenses || []).map((exp, idx) => {
        const autoCatId = getAutoCategory(exp.description, exp.category);
        const cat = EXPENSE_CATEGORIES.find(c => c.id === autoCatId);
        return {
          id: exp.id,
          name: exp.description || (language === 'ar' ? 'غير معلم' : 'Unnamed'),
          value: Number(exp.amount),
          category: autoCatId,
          percentage: expensesTotal > 0 ? ((Number(exp.amount) / expensesTotal) * 100).toFixed(1) : 0,
          fill: COLORS[idx % COLORS.length]
        };
      }).sort((a, b) => b.value - a.value);
      
      return {
        ...entry,
        actualSalary,
        actualUber,
        expensesTotal,
        monthlySavings,
        cumulativeCash: currentCashTotal,
        goldValue: currentCashTotal, 
        cumulativePlanned: currentPlannedTotal,
        goldWeight: currentCashTotal / currentGoldPrice,
        isNow: entry.id === currentMonthStr,
        expenseChartData,
        itemAnalysisData: expenseChartData
      };
    });

    const currentEntry = computedEntries.find(e => e.isNow) || computedEntries.find(e => e.id === '2026-05') || computedEntries[1];
    const lastEntry = computedEntries[computedEntries.length - 1];
    
    const startDate = new Date(profile.startDate);
    const monthsPassed = Math.max(0, (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth()));
    
    const progressMonths = Math.min(monthsPassed + 1, computedEntries.length);
    const totalMonths = computedEntries.length;

    const totalGoldLogged = goldLogs.reduce((acc, curr) => acc + (Number(curr.weight) || 0), 0);

    const goldDistributionData = goldLogs.map(log => ({
       name: log.notes || (language === 'ar' ? 'شراء' : 'Purchase'),
       value: Number(log.weight),
       fullValue: Number(log.weight) * currentGoldPrice,
       date: log.date
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      computedEntries,
      currentSavings: currentEntry?.cumulativeCash || 0,
      currentMonth: currentEntry,
      lastEntry,
      progressMonths,
      totalMonths,
      progressPercentage: Math.min(((currentEntry?.cumulativeCash || 0) / (profile?.targetCash || 1)) * 100, 100),
      totalGoldLogged,
      totalGoldValue: totalGoldLogged * currentGoldPrice,
      goldDistributionData
    };
  }, [entries, profile, currentGoldPrice, language, goldLogs]);

  const selectedEntry = useMemo(() => {
    return stats?.computedEntries.find(e => e.id === selectedMonthId) || stats?.currentMonth || null;
  }, [selectedMonthId, stats]);

  // AI Insight Fetcher
  useEffect(() => {
    const fetchAiInsight = async () => {
      if (!selectedEntry || !selectedEntry.expenses || selectedEntry.expenses.length < 1) {
        setAiInsight(null);
        return;
      }
      
      setIsLoadingInsight(true);
      try {
        const response = await fetch('/api/ai/insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            data: {
              expenses: selectedEntry.expenses.slice(-15), // Send last 15 for context
              total: selectedEntry.expensesTotal,
              month: selectedEntry.month,
              year: selectedEntry.year
            }, 
            language 
          }),
        });

        if (response.status === 429) {
          // Silent fallback for quota errors
          setAiInsight(null);
          return;
        }

        const result = await response.json();
        if (result.insight) {
          setAiInsight(result.insight);
        } else if (result.error) {
          if (response.status !== 429) {
            console.error('AI Insight Error:', result.error);
          }
          setAiInsight(null);
        }
      } catch (error) {
        // Only log if it's not a fetch error caused by likely network/abort
        if (!(error instanceof Error && error.name === 'AbortError')) {
          console.warn('AI insight fetch suppressed or failed');
        }
        setAiInsight(null);
      } finally {
        setIsLoadingInsight(false);
      }
    };

    const timer = setTimeout(fetchAiInsight, 1500); // Debounce a bit more
    return () => clearTimeout(timer);
  }, [selectedEntry?.id, (selectedEntry?.expenses || []).length, language]);

  // AI Advice Trigger
  useEffect(() => {
    if (user && profile && entries.length > 0) {
      const fetchAdvice = async () => {
        setAiLoading(true);
        // Only clear advice if we don't have one yet, to avoid flicker on updates
        if (!aiAdvice) setAiAdvice(null);
        
        try {
          // We pass the entries REVERSED so the most recent is entries[0]
          const advice = await getFinancialAdvice({ profile, entries: [...entries].reverse().slice(0, 5) }, language);
          setAiAdvice(advice);
        } catch (err: any) {
          console.error("Advice Fetch Error:", err);
          // Centralized aiService now handles fallbacks, but we add a safety net here
          setAiAdvice(language === 'ar' ? "تعذر جلب النصيحة حالياً. يرجى المحاولة لاحقاً." : "Could not fetch advice. Please try again later.");
        } finally {
          setAiLoading(false);
        }
      };
      
      fetchAdvice();
    }
  }, [user?.uid, profile?.userName, entries.length, language, selectedEntry?.expensesTotal]);

  const handleSmartAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smartInput.trim() || !selectedEntry) return;

    setIsSmartLoading(true);
    vibrate(10);
    try {
      const response = await fetch('/api/ai/parse-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: smartInput, language }),
      });

      if (response.status === 429) {
        alert(language === 'ar' ? "نفذت حصة الذكاء الاصطناعي اليوم. يرجى المحاولة لاحقاً." : "AI quota exceeded. Please try again later.");
        return;
      }

      const data = await response.json();
      
      if (data.amount && data.description) {
        const expense: Partial<ExpenseItem> = {
          description: data.description,
          amount: data.amount,
          category: data.category || 'other',
          date: new Date().toISOString().split('T')[0],
          isInstallment: !!data.isInstallment
        };

        if (data.isInstallment && data.installmentsCount) {
          // Add installments logic if needed, for now just add as one
          // Real apps would loop, but I'll stick to a simple add for now
        }

        const updatedExpenses = [...(selectedEntry.expenses || []), { ...expense, id: Date.now().toString() } as ExpenseItem];
        const expensesTotal = updatedExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
        
        await updateDoc(doc(db, 'profiles', user.uid, 'entries', selectedEntry.id), {
          expenses: updatedExpenses,
          expensesTotal
        });

        setSmartInput('');
        vibrate([10, 20, 10]);
      }
    } catch (error) {
      console.error('Smart add failed:', error);
    } finally {
      setIsSmartLoading(false);
    }
  };
  const handleResetData = async () => {
    if (!user || !window.confirm('هل أنت متأكد من مسح جميع البيانات وإعادة ضبط الخطة؟')) return;
    try {
      const batch = writeBatch(db);
      
      // Delete existing entries
      entries.forEach(e => {
        batch.delete(doc(db, 'profiles', user.uid, 'entries', e.id));
      });
      
      // Re-seed
      const profileRef = doc(db, 'profiles', user.uid);
      batch.set(profileRef, DEFAULT_PROFILE);
      
      INITIAL_PLAN.forEach((p, idx) => {
        const monthOffset = (4 + idx - 1) % 12 + 1;
        const yearOffset = p.year + Math.floor((4 + idx - 1) / 12);
        const id = `${yearOffset}-${String(monthOffset).padStart(2, '0')}`;
        
        // Logic: Past months get planned values, Current & Future get 0
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        
        const isPast = yearOffset < currentYear || (yearOffset === currentYear && monthOffset < currentMonth);

        const entryRef = doc(db, 'profiles', user.uid, 'entries', id);
        batch.set(entryRef, {
          year: p.year,
          month: p.month,
          plannedSalary: p.salary,
          plannedUber: p.uber,
          actualSalary: isPast ? p.salary : 0,
          actualUber: isPast ? p.uber : 0,
          expenses: [],
          notes: p.notes,
          order: idx
        });
      });

      await batch.commit();
      window.location.reload();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'reset');
    }
  };

  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6 text-center" dir="rtl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full space-y-12"
          >
            <div className="relative mx-auto w-44 h-44">
              {/* Outer Glow */}
              <div className="absolute inset-0 bg-white/10 blur-3xl rounded-full animate-pulse" />
              
              {/* Professional Custom Logo Container */}
              <div className="relative z-10 w-full h-full bg-black rounded-full border-2 border-white/20 shadow-2xl flex items-center justify-center overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                
                {/* The Ring (White) */}
                <div className="absolute inset-2 border-[4px] border-white/90 rounded-full flex items-center justify-center z-20">
                   {/* We'll use a stylized icon or the user's photo if they were pre-authenticated */}
                   <img 
                    src="/public/profile.jpg" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://img.icons8.com/color/144/user-male-circle--v1.png';
                    }}
                    alt="App Icon" 
                    className="w-full h-full object-cover rounded-full p-1" 
                  />
                </div>
                
                {/* Decorative Elements */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-4 bg-black z-30 flex items-center justify-center">
                  <div className="w-6 h-1 bg-white rounded-full" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic">
                Eanany <span className="text-white">$aving</span> Plan
              </h1>
              <div className="h-px w-24 bg-white/20 mx-auto opacity-50" />
              <p className="text-slate-400 font-bold tracking-[0.3em] text-[10px] uppercase">
                {language === 'ar' ? 'نظام إدارة الثروة الذكي' : 'SMART WEALTH MANAGEMENT'}
              </p>
            </div>

          <button 
            onClick={login}
            className="w-full flex items-center justify-center gap-3 bg-white text-black py-5 rounded-2xl text-lg font-black hover:bg-white/90 transition-all active:scale-95 shadow-xl"
          >
            <LogIn className="w-6 h-6" />
            بدء الرحلة الآن
          </button>
        </motion.div>
      </div>
    );
  }

  // Access Restriction
  if (user.email !== AUTHORIZED_EMAIL) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm glass card-outline p-12 rounded-[50px] border border-brand-red/50 space-y-8"
        >
          <div className="p-6 bg-brand-red/20 rounded-full inline-block">
             <ShieldAlert className="w-16 h-16 text-brand-red" />
          </div>
          <div className="space-y-4">
            <h2 className="text-2xl font-black text-white italic">خطأ في التصريح</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              عذراً، هذا التطبيق مخصص حصرياً للمالك المصرح له. يرجى تسجيل الدخول بحسابك الخاص.
            </p>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-black hover:bg-white/10 transition-all active:scale-95"
          >
            <LogOut className="w-5 h-5" />
            تسجيل الخروج
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen transition-all duration-500 relative bg-brand-bg", 
      isDark ? "text-white" : "text-slate-900",
      language === 'ar' ? 'rtl' : 'ltr'
    )} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Instagram-style floating header */}
      <header className={cn(
        "sticky top-0 z-40 backdrop-blur-xl border-b px-6 py-4 flex items-center justify-between transition-all duration-500 bg-brand-bg/80 border-brand-border"
      )}>
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className={cn(
                 "p-2 rounded-xl transition-all",
                 isDark ? "hover:bg-white/10 text-white" : "hover:bg-slate-100 text-slate-900"
               )}
             >
               <Menu className="w-6 h-6" />
             </button>
             <h1 className={cn(
               "text-xl font-black italic tracking-tighter uppercase",
               isDark ? "text-white" : "text-slate-900"
             )}>
                EANANY <span className={isDark ? "text-white/40" : "text-slate-400"}>SAVING</span>
             </h1>
          </div>

          <div className="flex items-center gap-4">
             <div className="w-8 h-8 rounded-full border border-brand-yellow/20 p-0.5 bg-white overflow-hidden shadow-sm">
                <img 
                  src="/public/profile.jpg" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = user?.photoURL || 'https://img.icons8.com/color/96/user-male-circle--v1.png';
                  }}
                  alt="" 
                  className="w-full h-full object-cover rounded-full"
                />
             </div>
          </div>
       </header>
      
      {/* Side Menu Drawer */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsSidebarOpen(false)}
               className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
            />
            
            <motion.div 
              initial={{ x: language === 'ar' ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: language === 'ar' ? '100%' : '-100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={cn(
                "fixed top-0 bottom-0 w-80 z-[101] shadow-2xl flex flex-col p-8 overflow-y-auto",
                language === 'ar' ? "right-0 rounded-l-[40px]" : "left-0 rounded-r-[40px]",
                isDark ? "bg-slate-900 border-white/10" : "bg-white border-slate-200"
              )}
            >
              <div className="flex flex-col gap-6 mb-12">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-12 h-12 rounded-2xl border-2 border-brand-yellow/20 p-1 bg-white overflow-hidden shadow-xl">
                          <img 
                            src="/public/profile.jpg" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = user.photoURL || 'https://img.icons8.com/color/96/user-male-circle--v1.png';
                            }}
                            alt="" 
                            className="w-full h-full object-cover rounded-xl"
                          />
                       </div>
                       <div>
                          <h2 className={cn("text-lg font-black italic tracking-tighter uppercase leading-none", isDark ? "text-white" : "text-slate-900")}>EANANY</h2>
                          <span className="text-[10px] font-bold text-brand-yellow uppercase tracking-[0.2em]">SAVING</span>
                       </div>
                    </div>
                    <button 
                      onClick={() => setIsSidebarOpen(false)}
                      className={cn(
                        "p-2 rounded-xl transition-all",
                        isDark ? "bg-white/5 text-slate-400" : "bg-slate-100 text-slate-500"
                      )}
                    >
                      <X className="w-5 h-5" />
                    </button>
                 </div>

                 {/* Toolbox Section */}
                 <div className={cn(
                   "p-3 rounded-3xl border flex items-center justify-around",
                   isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-200"
                 )}>
                    <button 
                      onClick={() => setShowValues(!showValues)}
                      className={cn(
                        "p-3 rounded-2xl transition-all",
                        isDark ? "hover:bg-white/10 text-slate-400 hover:text-white" : "hover:bg-white text-slate-600 hover:text-slate-950 shadow-sm"
                      )}
                      title={language === 'ar' ? 'إظهار/إخفاء' : 'Show/Hide'}
                    >
                       {showValues ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                    <button 
                      onClick={() => profile && exportPlanToExcel(profile, entries)}
                      className={cn(
                        "p-3 rounded-2xl transition-all",
                        isDark ? "hover:bg-white/10 text-slate-400 hover:text-white" : "hover:bg-white text-slate-600 hover:text-slate-950 shadow-sm"
                      )}
                      title={language === 'ar' ? 'تصدير إكسل' : 'Export Excel'}
                    >
                       <Download className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                      className={cn(
                        "px-4 py-3 rounded-2xl transition-all font-black text-xs italic",
                        isDark ? "hover:bg-white/10 text-slate-400 hover:text-white" : "hover:bg-white text-slate-600 hover:text-slate-950 shadow-sm"
                      )}
                    >
                       {language === 'ar' ? 'EN' : 'AR'}
                    </button>
                    <button 
                      onClick={() => {
                        const nextThemeIndex = (THEME_IDS.indexOf(theme as any) + 1) % THEME_IDS.length;
                        setTheme(THEME_IDS[nextThemeIndex] as any);
                        vibrate(5);
                      }}
                      className={cn(
                        "p-3 rounded-2xl transition-all",
                        isDark ? "hover:bg-white/10 text-slate-400 hover:text-white" : "hover:bg-white text-slate-600 hover:text-slate-950 shadow-sm"
                      )}
                    >
                       {isDark ? <Zap className="w-5 h-5 text-brand-yellow" /> : <Palette className="w-5 h-5" />}
                    </button>
                 </div>
              </div>

              <div className="space-y-3 flex-1">
                 <NavButton 
                    active={currentProject === 'savings'} 
                    onClick={() => { setCurrentProject('savings'); setIsSidebarOpen(false); }}
                    icon={<Wallet className="w-5 h-5" />}
                    label={language === 'ar' ? 'ادخار' : 'Savings'}
                    isDark={isDark}
                 />
                 <NavButton 
                    active={currentProject === 'expenses'} 
                    onClick={() => { setCurrentProject('expenses'); setIsSidebarOpen(false); }}
                    icon={<Receipt className="w-5 h-5" />}
                    label={language === 'ar' ? 'المصروفات' : 'Expenses'}
                    isDark={isDark}
                 />
                 <NavButton 
                    active={currentProject === 'gold'} 
                    onClick={() => { setCurrentProject('gold'); setIsSidebarOpen(false); }}
                    icon={<Coins className="w-5 h-5" />}
                    label={language === 'ar' ? 'الذهب' : 'Gold Tracker'}
                    isDark={isDark}
                 />
                 <NavButton 
                    active={currentProject === 'daily'} 
                    onClick={() => { setCurrentProject('daily'); setIsSidebarOpen(false); }}
                    icon={<Calendar className="w-5 h-5" />}
                    label={language === 'ar' ? 'الرصيد اليومي' : 'Daily Balance'}
                    isDark={isDark}
                 />
                 <NavButton 
                    active={currentProject === 'stats'} 
                    onClick={() => { setCurrentProject('stats'); setIsSidebarOpen(false); }}
                    icon={<BarChart3 className="w-5 h-5" />}
                    label={language === 'ar' ? 'الإحصائيات' : 'Statistics'}
                    isDark={isDark}
                 />
                 <NavButton 
                    active={currentProject === 'ai'} 
                    onClick={() => { setCurrentProject('ai'); setIsSidebarOpen(false); }}
                    icon={<Sparkles className="w-5 h-5" />}
                    label={language === 'ar' ? 'المساعد الذكي' : 'AI Assistant'}
                    isDark={isDark}
                 />
                 <NavButton 
                    active={currentProject === 'settings'} 
                    onClick={() => { setCurrentProject('settings'); setIsSidebarOpen(false); }}
                    icon={<Settings className="w-5 h-5" />}
                    label={language === 'ar' ? 'الإعدادات' : 'Settings'}
                    isDark={isDark}
                 />
              </div>

              <div className="mt-8 p-6 rounded-[30px] bg-brand-yellow/10 border border-brand-yellow/20">
                 <p className="text-[10px] font-black uppercase tracking-widest text-brand-yellow mb-2">Version 4.2.0</p>
                 <p className="text-xs text-slate-500 font-medium">
                   {language === 'ar' ? 'تحكم في مستقبلك المالي بكل ذكاء مع فلوستي.' : 'Control your financial future smartly with Flossy.'}
                 </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {currentProject === 'gold' ? (
        <div className="max-w-4xl mx-auto space-y-8 px-4 mb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className={cn("rounded-[40px] p-8 border transition-all", isDark ? "glass border-white/10" : "bg-white border-slate-200 shadow-sm")}>
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-14 h-14 rounded-2xl bg-amber-400/10 flex items-center justify-center">
                    <Coins className="w-8 h-8 text-amber-400" />
                 </div>
                 <div>
                    <h2 className={cn("text-3xl font-black italic uppercase tracking-tighter", isDark ? "text-white" : "text-slate-900")}>
                       {language === 'ar' ? 'متتبع الذهب' : 'Gold Tracker'}
                    </h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-loose">
                       {language === 'ar' ? 'سجل حيازتك من الذهب وراقب قيمتها لحظة بلحظة' : 'Track your gold physical holdings and monitor live value'}
                    </p>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
                 <div className={cn("p-8 rounded-3xl border flex flex-col justify-between", isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100")}>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{language === 'ar' ? 'إجمالي الوزن' : 'Total Weight'}</span>
                    <div className="mt-2 text-4xl font-black italic text-brand-yellow">
                       {(stats?.totalGoldLogged || 0).toFixed(1)} <span className="text-xs font-bold uppercase opacity-50">Unit</span>
                    </div>
                 </div>
                 <div className={cn("p-8 rounded-3xl border flex flex-col justify-between", isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100")}>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{language === 'ar' ? 'القيمة الإجمالية' : 'Total Value'}</span>
                    <div className={cn("mt-2 text-4xl font-black italic transition-all duration-500", isDark ? "text-white" : "text-slate-900", !showValues && "blur-xl")}>
                       {(stats?.currentMonth?.goldValue || 0).toLocaleString()} <span className="text-xs font-bold uppercase opacity-50">EGP</span>
                    </div>
                 </div>
                 <div className={cn("p-8 rounded-3xl border flex flex-col justify-between", isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100")}>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{language === 'ar' ? 'سعر الذهب (عيار 24)' : 'Gold Price (24k)'}</span>
                    <div className="mt-2 text-4xl font-black italic text-brand-yellow">
                       {currentGoldPrice.toLocaleString()} <span className="text-xs font-bold uppercase opacity-50">EGP/g</span>
                    </div>
                     <button 
                        disabled={isRefreshingGold}
                        onClick={async () => {
                           vibrate(10);
                           setIsRefreshingGold(true);
                           try {
                              const price = await getGoldPrice(true);
                              if (price > 2000) {
                                 setCurrentGoldPrice(price);
                                 if (user) await updateDoc(doc(db, 'profiles', user.uid), { goldPrice: price });
                              }
                           } catch (e) {
                              console.error("Manual refresh failed", e);
                           } finally {
                              setTimeout(() => setIsRefreshingGold(false), 800);
                           }
                        }}
                        className={cn(
                           "mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-400/10 border border-amber-400/20 text-[10px] font-black uppercase text-amber-400 hover:bg-amber-400/20 transition-all",
                           isRefreshingGold && "opacity-50 cursor-not-allowed"
                        )}
                     >
                        <RefreshCw className={cn("w-3 h-3", isRefreshingGold && "animate-spin")} />
                        {isRefreshingGold 
                           ? (language === 'ar' ? 'جاري التحديث...' : 'Refreshing...') 
                           : (language === 'ar' ? 'تحديث السعر المباشر' : 'Refresh Live Price')}
                     </button>
                 </div>
              </div>

              {goldLogs.length > 0 && (
                 <div className="mb-12 h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={stats?.goldDistributionData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                          <XAxis 
                             dataKey="date" 
                             tickFormatter={(str) => new Date(str).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                             stroke={isDark ? "#475569" : "#64748b"}
                             fontSize={10}
                             fontWeight="bold"
                          />
                          <Tooltip 
                             contentStyle={{ 
                                backgroundColor: isDark ? '#000' : '#fff', 
                                border: 'none', 
                                borderRadius: '16px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                             }}
                             itemStyle={{ color: '#fbbf24', fontWeight: 'bold' }}
                             formatter={(value: any) => [`${value} Unit`, language === 'ar' ? 'الوزن' : 'Weight']}
                          />
                          <Bar dataKey="value" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              )}

              <div className="space-y-4">
                 <div className="flex items-center justify-between px-2">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{language === 'ar' ? 'سجل العمليات' : 'Transaction History'}</h3>
                    <button 
                      onClick={() => setIsAddingGoldLog(true)}
                      className="text-[10px] font-black uppercase text-brand-yellow hover:underline"
                    >
                       {language === 'ar' ? '+ إضافة جديد' : '+ Add New'}
                    </button>
                 </div>
                 <div className="space-y-3">
                    {goldLogs && goldLogs.length > 0 ? (
                       [...goldLogs].reverse().map(log => (
                          <div key={log.id} className={cn("p-6 rounded-3xl border flex items-center justify-between group transition-all", isDark ? "bg-white/2 border-white/5" : "bg-white border-slate-100 shadow-sm")}>
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center">
                                   <Coins className="w-5 h-5 text-amber-400" />
                                </div>
                                <div>
                                   <div className={cn("text-sm font-black italic", isDark ? "text-white" : "text-slate-900")}>{log.weight} {language === 'ar' ? 'جرام' : 'g'}</div>
                                   <div className="flex items-center gap-2">
                                      <div className="text-[10px] text-slate-500 font-bold uppercase">{log.notes || (language === 'ar' ? 'عملية شراء' : 'Purchase')}</div>
                                      {(currentGoldPrice - (log.price || 0)) !== 0 && (
                                         <div className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5", 
                                            (currentGoldPrice - (log.price || 0)) > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                                         )}>
                                            {(currentGoldPrice - (log.price || 0)) > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                            {Math.abs(((currentGoldPrice - (log.price || 0)) / (log.price || 1)) * 100).toFixed(1)}%
                                         </div>
                                      )}
                                   </div>
                                </div>
                             </div>
                             <div className="text-right flex items-center gap-6">
                                <div className="hidden sm:block">
                                   <div className="text-[10px] text-slate-500 font-bold uppercase text-right leading-tight">{language === 'ar' ? 'القيمة الحالية' : 'Current Value'}</div>
                                   <div className={cn("text-xs font-black", (currentGoldPrice - (log.price || 0)) > 0 ? "text-emerald-500" : (currentGoldPrice - (log.price || 0)) < 0 ? "text-rose-500" : "text-slate-500")}>
                                      {(log.weight * currentGoldPrice).toLocaleString()}
                                   </div>
                                </div>
                                <div className="hidden sm:block border-l border-white/5 pl-6 text-right">
                                   <div className="text-[10px] text-slate-500 font-bold uppercase opacity-50">{language === 'ar' ? 'سعر الشراء' : 'Buy Price'}</div>
                                   <div className={cn("text-xs font-black opacity-30", isDark ? "text-slate-300" : "text-slate-600")}>{log.price?.toLocaleString()}</div>
                                </div>
                                <button 
                                  onClick={async () => {
                                    if (!user) return;
                                    if (window.confirm(language === 'ar' ? 'حذف هذه العملية؟' : 'Delete this entry?')) {
                                      try {
                                        await deleteDoc(doc(db, 'profiles', user.uid, 'goldLogs', log.id));
                                      } catch (err) {
                                        handleFirestoreError(err, OperationType.DELETE, 'gold-log');
                                      }
                                    }
                                  }}
                                  className="p-2 opacity-0 group-hover:opacity-100 transition-all text-slate-500 hover:text-brand-red"
                                >
                                   <Trash2 className="w-4 h-4" />
                                </button>
                             </div>
                          </div>
                       ))
                    ) : (
                       <div className="py-20 text-center opacity-30">
                          <Coins className="w-12 h-12 mx-auto mb-4" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">{language === 'ar' ? 'لا توجد بيانات مسجلة' : 'No recorded data'}</p>
                       </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      ) : currentProject === 'stats' ? (
        <div className="max-w-6xl mx-auto space-y-8 px-4 mb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className={cn("rounded-[40px] p-8 border transition-all", isDark ? "glass border-white/10" : "bg-white border-slate-200 shadow-sm")}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                 <div>
                    <h2 className={cn("text-4xl font-black italic uppercase tracking-tighter", isDark ? "text-white" : "text-slate-900")}>
                       {language === 'ar' ? 'تحليل النمو' : 'Growth Analytics'}
                    </h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-loose mt-2">
                       {language === 'ar' ? 'رؤية عميقة لذكاء مستقبلك المالي' : 'Deep insights into your financial future intelligence'}
                    </p>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className={cn("px-6 py-3 rounded-2xl border flex flex-col", isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100")}>
                       <span className="text-[8px] font-black text-slate-500 uppercase">{language === 'ar' ? 'صافي الثروة' : 'Net Worth'}</span>
                       <span className="text-xl font-black italic">{( (stats?.currentMonth?.cumulativeCash || 0) + (stats?.totalGoldValue || 0) ).toLocaleString()} <span className="text-[10px]">EGP</span></span>
                    </div>
                 </div>
              </div>
              
              <div className="h-[400px] w-full mb-12 relative">
                 <div className="absolute top-4 left-4 z-10">
                    <div className="flex items-center gap-4">
                       <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-brand-yellow" />
                          <span className="text-[8px] font-black uppercase text-slate-500">{language === 'ar' ? 'فعلي' : 'Actual'}</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-slate-400 opacity-30" />
                          <span className="text-[8px] font-black uppercase text-slate-500">{language === 'ar' ? 'مخطط' : 'Planned'}</span>
                       </div>
                    </div>
                 </div>
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats?.computedEntries}>
                       <defs>
                          <linearGradient id="colorCumul" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3}/>
                             <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} vertical={false} />
                       <XAxis 
                         dataKey="month" 
                         stroke={isDark ? "#475569" : "#64748b"} 
                         fontSize={10} 
                         fontWeight="bold" 
                         tickFormatter={(val) => val.substring(0, 3)}
                       />
                       <YAxis 
                         stroke={isDark ? "#475569" : "#64748b"} 
                         fontSize={10} 
                         fontWeight="bold" 
                         tickFormatter={(val) => `${val/1000}k`}
                       />
                       <Tooltip 
                          contentStyle={{ 
                             backgroundColor: isDark ? '#000' : '#fff', 
                             border: 'none', 
                             borderRadius: '20px', 
                             boxShadow: '0 10px 30px rgba(0,0,0,0.2)' 
                          }}
                          itemStyle={{ fontSize: '12px', fontWeight: '900' }}
                       />
                       <Area 
                          type="monotone" 
                          dataKey="cumulativeCash" 
                          stroke="#fbbf24" 
                          strokeWidth={4}
                          fillOpacity={1} 
                          fill="url(#colorCumul)" 
                          name={language === 'ar' ? 'تراكمي فعلي' : 'Cumul. Actual'}
                       />
                       <Area 
                          type="monotone" 
                          dataKey="cumulativePlanned" 
                          stroke={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"} 
                          strokeWidth={2}
                          strokeDasharray="10 10"
                          fill="transparent"
                          name={language === 'ar' ? 'تراكمي مخطط' : 'Cumul. Target'}
                       />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                  <div className={cn("lg:col-span-2 rounded-[40px] p-8 border", isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100 shadow-sm")}>
                     <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-8">{language === 'ar' ? 'تحليل المصاريف والادخار' : 'Savings vs Expenses Trend'}</h3>
                     <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={stats?.computedEntries.slice(-6)}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                              <XAxis dataKey="month" stroke={isDark ? "#475569" : "#64748b"} fontSize={10} fontWeight="bold" />
                              <YAxis stroke={isDark ? "#475569" : "#64748b"} fontSize={10} fontWeight="bold" />
                              <Tooltip contentStyle={{ backgroundColor: isDark ? '#000' : '#fff', borderRadius: '16px', border: 'none' }} />
                              <Bar dataKey="expensesTotal" fill="#f43f5e" radius={[6, 6, 0, 0]} name={language === 'ar' ? 'المصاريف' : 'Expenses'} />
                              <Bar dataKey="monthlySavings" fill="#10b981" radius={[6, 6, 0, 0]} name={language === 'ar' ? 'الادخار' : 'Savings'} />
                           </BarChart>
                        </ResponsiveContainer>
                     </div>
                  </div>
                  <div className={cn("rounded-[40px] p-8 border flex flex-col items-center justify-center", isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100 shadow-sm")}>
                     <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-8">{language === 'ar' ? 'توزيع المحفظة' : 'Portfolio Mix'}</h3>
                     <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                           <PieChart>
                              <Pie
                                 data={[
                                    { name: language === 'ar' ? 'سيولة' : 'Cash', value: stats?.currentMonth?.cumulativeCash || 0, fill: '#64748b' },
                                    { name: language === 'ar' ? 'ذهب' : 'Gold', value: stats?.totalGoldValue || 0, fill: '#fbbf24' }
                                 ]}
                                 innerRadius={70}
                                 outerRadius={100}
                                 paddingAngle={8}
                                 dataKey="value"
                                 stroke="none"
                              >
                                 <Cell fill={isDark ? "rgba(255,255,255,0.05)" : "#e2e8f0"} />
                                 <Cell fill="#fbbf24" stroke={isDark ? "rgba(251, 191, 36, 0.2)" : "none"} strokeWidth={10} />
                                 <Label 
                                    content={({ viewBox }) => {
                                       const { cx, cy } = viewBox as any;
                                       const total = (stats?.currentMonth?.cumulativeCash || 0) + (stats?.totalGoldValue || 0) || 1;
                                       const goldPerc = Math.round(((stats?.totalGoldValue || 0) / total) * 100);
                                       return (
                                          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                                             <tspan x={cx} y={cy - 5} className={cn("text-3xl font-black italic", isDark ? "fill-white" : "fill-slate-900")}>
                                                {goldPerc}%
                                             </tspan>
                                             <tspan x={cx} y={cy + 20} className="fill-slate-500 text-[10px] font-black uppercase tracking-widest">{language === 'ar' ? 'ذهب' : 'GOLD'}</tspan>
                                          </text>
                                       );
                                    }}
                                 />
                              </Pie>
                              <Tooltip 
                                 contentStyle={{ backgroundColor: isDark ? '#000' : '#fff', border: 'none', borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.2)' }}
                                 itemStyle={{ color: '#fbbf24', fontWeight: '900', fontSize: '12px' }}
                              />
                           </PieChart>
                        </ResponsiveContainer>
                     </div>
                     <div className="flex gap-4 mt-6">
                        <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-slate-400 opacity-30" />
                           <span className="text-[8px] font-black uppercase text-slate-500">{language === 'ar' ? 'سيولة' : 'Cash'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-brand-yellow" />
                           <span className="text-[8px] font-black uppercase text-slate-500">{language === 'ar' ? 'ذهب' : 'Gold'}</span>
                        </div>
                     </div>
                  </div>
               </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                 <div className={cn("p-6 rounded-3xl border flex flex-col justify-between", isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100")}>
                    <div>
                       <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{language === 'ar' ? 'معدل الادخار' : 'Savings Rate'}</div>
                       <div className="text-2xl font-black italic text-emerald-500">
                          {Math.round(((stats?.currentMonth?.monthlySavings || 0) / ( (stats?.currentMonth?.actualSalary || 1) + (stats?.currentMonth?.actualUber || 0) )) * 100)}%
                       </div>
                    </div>
                    <p className="text-[8px] text-slate-500 font-medium mt-2">{language === 'ar' ? 'نسبة ما تدخره من دخلك الإجمالي' : '% of total income saved'}</p>
                 </div>
                 
                 <div className={cn("p-6 rounded-3xl border flex flex-col justify-between", isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100")}>
                    <div>
                       <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{language === 'ar' ? 'النمو بفضل الذهب' : 'Gold Growth Hub'}</div>
                       <div className="text-2xl font-black italic text-amber-500">
                          +{(stats?.totalGoldValue || 0).toLocaleString()} <span className="text-xs">EGP</span>
                       </div>
                    </div>
                    <p className="text-[8px] text-slate-500 font-medium mt-2">{language === 'ar' ? 'القيمة الحالية لاستثمارات الذهب' : 'Current net worth of gold'}</p>
                 </div>

                 <div className={cn("p-6 rounded-3xl border flex flex-col justify-between", isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100")}>
                    <div>
                       <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{language === 'ar' ? 'الالتزام المالي' : 'Plan Sync'}</div>
                       <div className="text-2xl font-black italic">
                          {Math.round(((stats?.currentMonth?.cumulativeCash || 0) / (stats?.currentMonth?.cumulativePlanned || 1)) * 100)}%
                       </div>
                    </div>
                    <p className="text-[8px] text-slate-500 font-medium mt-2">{language === 'ar' ? 'مدى التطابق مع المخطط' : 'Adherence to planned targets'}</p>
                 </div>

                 <div className={cn("p-6 rounded-3xl border flex flex-col justify-between", isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100")}>
                    <div>
                       <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{language === 'ar' ? 'توزيع الثروة' : 'Wealth Split'}</div>
                        <div className="flex items-center gap-2 mt-2">
                           <div className="h-1.5 flex-1 rounded-full bg-brand-yellow" style={{ width: `${Math.max(10, ((stats?.totalGoldValue || 0) / ((stats?.currentMonth?.cumulativeCash || 0) + (stats?.totalGoldValue || 0) || 1)) * 100)}%` }} title="Gold" />
                           <div className="h-1.5 flex-1 rounded-full bg-slate-500" style={{ width: `${Math.max(10, ((stats?.currentMonth?.cumulativeCash || 0) / ((stats?.currentMonth?.cumulativeCash || 0) + (stats?.totalGoldValue || 0) || 1)) * 100)}%` }} title="Cash" />
                        </div>
                        <div className="flex justify-between text-[7px] font-black uppercase mt-1">
                           <span className="text-brand-yellow">Gold</span>
                           <span className="text-slate-500">Cash</span>
                        </div>
                     </div>
                     <p className="text-[8px] text-slate-500 font-medium mt-2">{language === 'ar' ? 'نسبة الذهب والسيولة' : 'Ratio of gold vs cash'}</p>
                  </div>

                  <div className={cn("p-6 rounded-3xl border flex flex-col justify-between", isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100 shadow-sm")}>
                     <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{language === 'ar' ? 'التوقع السنوي' : 'Annual Outlook'}</div>
                       <div className="text-2xl font-black italic">
                          {( (stats?.currentMonth?.cumulativeCash || 0) + (profile?.savingsTarget || 0) * (12 - stats?.computedEntries.length) ).toLocaleString()} <span className="text-xs">EGP</span>
                       </div>
                    </div>
                    <p className="text-[8px] text-slate-500 font-medium mt-2">{language === 'ar' ? 'إجمالي المتوقع بنهاية العام' : 'Projected total by end of year'}</p>
                 </div>
              </div>
           </div>
        </div>
      ) : currentProject === 'ai' ? (
        <div className="max-w-4xl mx-auto px-4 mb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className={cn("rounded-[40px] p-8 border min-h-[600px] flex flex-col relative overflow-hidden", isDark ? "glass border-white/10" : "bg-white border-slate-200 shadow-sm")}>
              <div className="absolute top-0 right-0 w-96 h-96 bg-brand-yellow/5 rounded-full blur-[120px] pointer-events-none" />
              
              <div className="flex items-center gap-4 mb-8">
                 <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl", isDark ? "bg-white text-black" : "bg-slate-900 text-white")}>
                    <Sparkles className="w-8 h-8" />
                 </div>
                 <div>
                    <h2 className={cn("text-3xl font-black italic uppercase tracking-tighter", isDark ? "text-white" : "text-slate-900")}>
                       {language === 'ar' ? 'المساعد المالي AI' : 'AI Financial Assistant'}
                    </h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{language === 'ar' ? 'نظام ذكاء اصطناعي لتحليل بياناتك المالية' : 'Generative AI system analyzing your financial data'}</p>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pr-2 mb-8 custom-scrollbar">
                 <div className={cn("p-6 rounded-3xl border-2 transition-all", isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900")}>
                    <div className="flex items-center gap-2 mb-4">
                       <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                       <span className="text-[10px] font-black uppercase tracking-widest">{language === 'ar' ? 'توصية الخبير' : 'Expert Insight'}</span>
                    </div>
                    <div className={cn("markdown-body prose prose-sm max-w-none px-2", isDark ? "prose-invert" : "")}>
                       <Markdown>{aiAdvice}</Markdown>
                    </div>
                 </div>
                 
                 <div className="flex justify-center flex-col items-center gap-4 py-12 opacity-30">
                    <MessageCircle className="w-12 h-12" />
                    <p className="text-xs font-bold uppercase tracking-widest">{language === 'ar' ? 'دردشة حية مدعومة بـ Gemini' : 'Live Chat powered by Gemini'}</p>
                 </div>
              </div>

              <div className="relative group">
                 <button 
                   onClick={() => setShowAiChat(true)}
                   className="w-full h-20 bg-brand-yellow text-black rounded-3xl font-black italic text-xl flex items-center justify-center gap-4 shadow-2xl shadow-brand-yellow/20 hover:scale-[1.02] active:scale-95 transition-all"
                 >
                    <MessageCircle className="w-6 h-6" />
                    {language === 'ar' ? 'فتح الدردشة الذكية' : 'Open Smart Chat'}
                 </button>
              </div>
           </div>
        </div>
      ) : currentProject === 'daily' ? (
        <div className="max-w-4xl mx-auto space-y-8">
           {/* Daily Balance Card */}
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className={cn(
               "rounded-[40px] p-8 border relative overflow-hidden transition-all duration-500",
               isDark ? "glass border-white/10" : "bg-white border-slate-200 shadow-sm"
             )}
           >
              <div className="relative z-10">
                <div className="flex items-center gap-3 text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">
                  <Calculator className="w-4 h-4 text-white" />
                  {language === 'ar' ? 'حساب يومي مستقل' : 'Standalone Daily Account'}
                </div>
                <div className="flex justify-between items-end">
                   <div className="space-y-1">
                      <div className="text-sm font-medium text-slate-500">
                        {language === 'ar' ? 'الرصيد الحالي' : 'Current Balance'}
                      </div>
                      <div className={cn(
                        "text-6xl font-black italic tracking-tighter transition-all duration-500",
                        !showValues && "blur-xl opacity-50 scale-95",
                        (profile?.dailyBalance || 0) >= 0 
                          ? (isDark ? "text-white" : "text-slate-900") 
                          : "text-brand-red"
                      )}>
                        {`${(profile?.dailyBalance || 0).toLocaleString()} ${language === 'ar' ? 'ج.م' : 'EGP'}`}
                      </div>
                   </div>
                   <button 
                     onClick={async () => {
                       if (window.confirm(language === 'ar' ? 'هل تريد تصفير الحساب؟' : 'Reset account to zero?')) {
                         try {
                           await updateDoc(doc(db, 'profiles', user.uid), { dailyBalance: 0 });
                        } catch (err) {
                          handleFirestoreError(err, OperationType.UPDATE, 'daily-reset');
                        }
                      }
                    }}
                    className="p-4 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-brand-red transition-all"
                  >
                    <RotateCcw className="w-6 h-6" />
                  </button>
               </div>
             </div>
             <div className="absolute top-0 right-0 p-8 opacity-10">
                <Coins className="w-32 h-32" />
             </div>
          </motion.div>

          {/* Input Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className={cn(
                "rounded-[40px] p-8 border space-y-6 transition-all duration-500",
                isDark ? "glass border-white/10" : "bg-white border-slate-200 shadow-sm"
             )}>
                <h3 className={cn("text-xl font-black italic", isDark ? "text-white" : "text-slate-900")}>
                   {language === 'ar' ? 'تسجيل معاملة' : 'Record Transaction'}
                </h3>
                <div className="relative">
                  <input 
                    type="number"
                    value={dailyInput}
                    onChange={(e) => setDailyInput(e.target.value)}
                    placeholder="0.00"
                    className={cn(
                      "w-full h-20 border-2 rounded-3xl px-8 text-3xl font-black outline-none transition-all",
                      isDark ? "bg-black/40 border-white/10 text-white focus:border-white/50" : "bg-white border-slate-200 text-slate-900 focus:border-slate-400"
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <button 
                     onClick={async () => {
                       const val = Number(dailyInput);
                       if (!val || isNaN(val)) return;
                       try {
                         await updateDoc(doc(db, 'profiles', user.uid), { dailyBalance: (profile?.dailyBalance || 0) + val });
                         setDailyInput('');
                       } catch (err) {
                         handleFirestoreError(err, OperationType.UPDATE, 'daily-plus');
                       }
                     }}
                     className={cn(
                       "h-20 border rounded-3xl flex items-center justify-center gap-3 font-black active:scale-95 transition-all w-full",
                       isDark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                     )}
                   >
                     <PlusCircle className="w-6 h-6" />
                     {language === 'ar' ? 'إضافة' : 'Add'}
                   </button>
                   <button 
                     onClick={async () => {
                       const val = Number(dailyInput);
                       if (!val || isNaN(val)) return;
                       try {
                         await updateDoc(doc(db, 'profiles', user.uid), { dailyBalance: (profile?.dailyBalance || 0) - val });
                         setDailyInput('');
                       } catch (err) {
                         handleFirestoreError(err, OperationType.UPDATE, 'daily-minus');
                       }
                     }}
                     className={cn(
                       "h-20 border rounded-3xl flex items-center justify-center gap-3 font-black active:scale-95 transition-all w-full",
                       isDark ? "bg-brand-red/10 border-brand-red/30 text-brand-red hover:bg-brand-red/20" : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                     )}
                   >
                     <MinusCircle className="w-6 h-6" />
                     {language === 'ar' ? 'خصم' : 'Subtract'}
                   </button>
                </div>
             </div>

             <div className={cn(
                "rounded-[40px] p-8 border space-y-6 transition-all duration-500 flex flex-col justify-between",
                isDark ? "glass border-white/10" : "bg-white border-slate-200 shadow-sm"
             )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Goal className="w-6 h-6 text-brand-red" />
                    <h3 className={cn("text-xl font-black italic uppercase tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                      {language === 'ar' ? 'متعقب الأهداف المالية' : 'Financial Goal Tracker'}
                    </h3>
                  </div>
                  
                  {!isEditingTargets ? (
                    <button
                      onClick={() => {
                        vibrate(5);
                        setEditTargetCash((profile?.targetCash || 359300).toString());
                        setEditTargetGold((profile?.targetGold || 44.91).toString());
                        setIsEditingTargets(true);
                      }}
                      className={cn(
                        "p-2 rounded-xl border transition-all duration-300",
                        isDark 
                          ? "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10" 
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                      )}
                      title={language === 'ar' ? 'تعديل المستهدفات' : 'Edit Target Goals'}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        vibrate(5);
                        setIsEditingTargets(false);
                      }}
                      className={cn(
                        "p-2 rounded-xl border transition-all duration-300",
                        isDark 
                          ? "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10" 
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                      )}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isEditingTargets ? (
                  <div className="space-y-4">
                    {/* Cash Target Input */}
                    <div>
                      <label className={cn("block text-[10px] font-black uppercase tracking-wider mb-1", isDark ? "text-slate-400" : "text-slate-500")}>
                        {language === 'ar' ? 'المستهدف النقدي الإجمالي (ج.م)' : 'Total Cash Target (EGP)'}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={editTargetCash}
                          onChange={(e) => setEditTargetCash(e.target.value)}
                          className={cn(
                            "w-full px-4 py-3 rounded-2xl border text-sm font-black transition-all duration-300 focus:outline-none focus:ring-2",
                            isDark 
                              ? "bg-white/5 border-white/10 text-white focus:ring-brand-red focus:border-transparent" 
                              : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-rose-500 focus:border-transparent"
                          )}
                        />
                      </div>
                    </div>

                    {/* Gold Target Input */}
                    <div>
                      <label className={cn("block text-[10px] font-black uppercase tracking-wider mb-1", isDark ? "text-slate-400" : "text-slate-500")}>
                        {language === 'ar' ? 'مستهدف الذهب الإجمالي (جرام)' : 'Total Gold Target (Grams)'}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={editTargetGold}
                          onChange={(e) => setEditTargetGold(e.target.value)}
                          className={cn(
                            "w-full px-4 py-3 rounded-2xl border text-sm font-black transition-all duration-300 focus:outline-none focus:ring-2",
                            isDark 
                              ? "bg-white/5 border-white/10 text-white focus:ring-brand-red focus:border-transparent" 
                              : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-rose-500 focus:border-transparent"
                          )}
                        />
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={async () => {
                          vibrate(5);
                          setIsEditingTargets(false);
                        }}
                        className={cn(
                          "py-2.5 rounded-xl border text-xs font-black transition-all duration-300 text-center",
                          isDark 
                            ? "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10" 
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>

                      <button
                        onClick={async () => {
                          vibrate(5);
                          const newCash = Number(editTargetCash);
                          const newGold = Number(editTargetGold);
                          if (!isNaN(newCash) && !isNaN(newGold)) {
                            try {
                              await updateDoc(doc(db, 'profiles', user.uid), { 
                                targetCash: newCash, 
                                targetGold: newGold 
                              });
                              setIsEditingTargets(false);
                            } catch (err) {
                              handleFirestoreError(err, OperationType.UPDATE, 'goals-update');
                            }
                          }
                        }}
                        className="py-2.5 rounded-xl bg-brand-red hover:bg-brand-red/90 text-white text-xs font-black transition-all duration-300 flex items-center justify-center gap-1.5 shadow-md shadow-brand-red/10"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {language === 'ar' ? 'حفظ الأهداف' : 'Save Goals'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Cash target metrics */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className={cn("font-bold", isDark ? "text-slate-400" : "text-slate-500")}>
                          {language === 'ar' ? 'القيمة المتوفرة مقارنة بالهدف' : 'Savings vs Cash Target'}
                        </span>
                        <span className="font-black text-brand-red italic">
                          {stats ? Math.round(stats.progressPercentage) : 0}%
                        </span>
                      </div>
                      
                      {/* Cash progress bar */}
                      <div className={cn("relative w-full h-3 rounded-full overflow-hidden", isDark ? "bg-white/5" : "bg-slate-100")}>
                        <div 
                          className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-600 transition-all duration-1000 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                          style={{ width: `${stats ? Math.min(stats.progressPercentage, 100) : 0}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] font-black uppercase">
                        <span className={cn(isDark ? "text-slate-300" : "text-slate-900")}>
                          {(!showValues) ? '••••' : (stats?.currentSavings || 0).toLocaleString()} EGP
                        </span>
                        <span className="text-slate-500">
                          {language === 'ar' ? 'المستهدف: ' : 'Target: '} {(profile?.targetCash || 359300).toLocaleString()} EGP
                        </span>
                      </div>
                    </div>

                    {/* Gold target metrics */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className={cn("font-bold", isDark ? "text-slate-400" : "text-slate-500")}>
                          {language === 'ar' ? 'الذهب المخزن مقارنة بالهدف' : 'Gold Logged vs Target'}
                        </span>
                        <span className="font-black text-yellow-500 italic">
                          {stats && profile && profile.targetGold 
                            ? Math.round(Math.min(((stats.totalGoldLogged || 0) / (profile.targetGold || 44.91)) * 100, 100)) 
                            : 0}%
                        </span>
                      </div>
                      
                      {/* Gold progress bar */}
                      <div className={cn("relative w-full h-3 rounded-full overflow-hidden", isDark ? "bg-white/5" : "bg-slate-100")}>
                        <div 
                          className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all duration-1000 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                          style={{ 
                            width: `${stats && profile && profile.targetGold 
                              ? Math.min(((stats.totalGoldLogged || 0) / (profile.targetGold || 44.91)) * 100, 100) 
                              : 0}%` 
                          }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] font-black uppercase">
                        <span className={cn(isDark ? "text-slate-300" : "text-slate-900")}>
                          {(!showValues) ? '••••' : (stats?.totalGoldLogged || 0).toFixed(2)} g
                        </span>
                        <span className="text-slate-500">
                          {language === 'ar' ? 'المستهدف: ' : 'Target: '} {(profile?.targetGold || 44.91).toFixed(2)} g
                        </span>
                      </div>
                    </div>

                    {/* Status Note */}
                    <div className={cn("p-4 rounded-2xl text-[10px] text-center font-bold tracking-wide border", isDark ? "bg-white/5 border-white/5 text-slate-300" : "bg-slate-50 border-slate-100 text-slate-600")}>
                      {language === 'ar' ? (
                        stats && stats.progressPercentage >= 100 ? (
                          "🎉 رائع! لقد حققت هدفك المالي بالكامل بنسبة 100%!"
                        ) : (
                          `أنت على بعد ${Math.max(0, 100 - Math.round(stats?.progressPercentage || 0))}% من تحقيق هدفك المالي النقدي.`
                        )
                      ) : (
                        stats && stats.progressPercentage >= 100 ? (
                          "🎉 Spectacular! You have achieved 100% of your monetary goal!"
                        ) : (
                          `You are ${Math.max(0, 100 - Math.round(stats?.progressPercentage || 0))}% away from achieving your EGP goal.`
                        )
                      )}
                    </div>
                  </div>
                )}
             </div>
          </div>

            {/* Interactive Roadmap */}
            <div className={cn("rounded-[40px] p-8 border transition-all", isDark ? "glass border-white/10" : "bg-white border-slate-200 shadow-sm")}>
               <div className="flex items-center gap-3 mb-8">
                 <Target className={cn("w-6 h-6", isDark ? "text-white" : "text-slate-900")} />
                 <h3 className={cn("text-xl font-black italic uppercase tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                    {language === 'ar' ? 'خارطة طريق الأهداف' : 'Interactive Roadmap'}
                 </h3>
               </div>
               <div className="relative">
                  {/* Timeline Line */}
                  <div className={cn("absolute top-1/2 left-0 w-full h-0.5 -translate-y-1/2", isDark ? "bg-white/5" : "bg-slate-200")} />
                  
                  <div className="relative z-10 flex justify-between gap-4 overflow-x-auto pb-8 pt-4 custom-scrollbar">
                     {[
                       { age: '24', label: language === 'ar' ? 'بداية الرحلة' : 'Start Journey', active: true, date: '2026' },
                       { age: '25', label: language === 'ar' ? 'تجميع 100 ألف' : '100K Milestone', active: stats && stats.currentSavings >= 100000, date: '2027' },
                       { age: '26', label: language === 'ar' ? 'تجميع 250 ألف' : '250K Milestone', active: stats && stats.currentSavings >= 250000, date: '2027' },
                       { age: '27', label: language === 'ar' ? 'الهدف المالي' : 'Final Goal', active: stats && stats.currentSavings >= (profile?.targetCash || 0), date: '2028' },
                     ].map((step, idx) => (
                       <div key={idx} className="flex flex-col items-center min-w-[120px] group">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 mb-4",
                            step.active ? "bg-white border-transparent text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]" : "bg-black border-white/10 text-slate-600"
                          )}>
                             <span className="text-xs font-black">{step.age}</span>
                          </div>
                          <div className="text-center space-y-1">
                             <div className={cn("text-[10px] font-black uppercase tracking-tighter", step.active ? "text-white" : "text-slate-600")}>{step.label}</div>
                             <div className="text-[8px] font-bold text-slate-500 uppercase">{step.date}</div>
                          </div>
                          {step.active && <div className="mt-4 w-1.5 h-1.5 bg-white rounded-full animate-ping" />}
                       </div>
                     ))}
                  </div>
               </div>
            </div>

            {/* Savings Challenge */}
            <div className={cn(
              "rounded-[40px] p-8 border transition-all duration-500",
              isDark ? "glass border-white/10" : "bg-white border-slate-200 shadow-sm"
            )}>
               <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                   <Flame className="w-6 h-6 text-orange-500" />
                   <h3 className={cn("text-xl font-black italic uppercase tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                      {language === 'ar' ? 'تحدي التوفير الذكي' : 'Savings Challenge'}
                   </h3>
                 </div>
                 <div className="px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-[8px] font-black text-orange-500 uppercase tracking-widest">
                    Hot Streak: 12 Days
                 </div>
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: language === 'ar' ? 'توفير غداء' : 'Skip Outer Lunch', amount: 300, icon: <Box className="w-4 h-4" /> },
                    { label: language === 'ar' ? 'توفير قهوة' : 'Save Coffee $', amount: 150, icon: <RefreshCw className="w-4 h-4" /> },
                    { label: language === 'ar' ? 'مشوار أوبر أقل' : 'Uber Offset', amount: 500, icon: <Car className="w-4 h-4 text-black" /> },
                    { label: language === 'ar' ? 'إيداع عشوائي' : 'Random Deposit', amount: 1000, icon: <Siren className="w-4 h-4 text-red-500" /> },
                  ].map((task, idx) => (
                      <button 
                        key={idx}
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'profiles', user.uid), { dailyBalance: (profile?.dailyBalance || 0) + task.amount });
                          } catch (err) {
                             handleFirestoreError(err, OperationType.UPDATE, 'challenge-click');
                          }
                        }}
                        className={cn(
                          "p-6 border rounded-[32px] flex flex-col items-center gap-3 transition-all active:scale-95 text-center group",
                          isDark ? "bg-white/2 border-white/5 hover:bg-white/5 hover:border-white/30" : "bg-slate-50 border-slate-100 hover:bg-white hover:border-slate-200 shadow-sm"
                        )}
                      >
                         <div className={cn(
                           "w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-inner",
                           isDark ? "bg-white/5 text-slate-500 group-hover:text-white" : "bg-white text-slate-400 group-hover:text-slate-900"
                         )}>
                            {task.icon}
                         </div>
                         <div className="space-y-1">
                            <div className={cn("text-[10px] font-bold uppercase tracking-widest", isDark ? "text-slate-400" : "text-slate-500")}>{task.label}</div>
                            <div className={cn(
                              "text-lg font-black transition-all duration-500",
                              isDark ? "text-white" : "text-slate-900",
                              !showValues && "blur-md opacity-50 scale-95"
                            )}>
                              +{task.amount}
                            </div>
                         </div>
                      </button>
                  ))}
               </div>
            </div>
         </div>
      ) : currentProject === 'expenses' ? (
        <div className="max-w-6xl mx-auto space-y-8 px-4 mb-32 scroll-mt-24">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8"
          >
            <div className="space-y-8">
              <div className="flex justify-between items-center mb-8">
                <div className="space-y-1">
                  <h2 className={cn("text-3xl font-black italic uppercase tracking-tighter", isDark ? "text-white" : "text-slate-900")}>
                    {language === 'ar' ? 'متتبع المصروفات' : 'Expense Tracker'}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <select
                      value={selectedMonthId || ''}
                      onChange={(e) => {
                        setSelectedMonthId(e.target.value);
                        vibrate(5);
                      }}
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-widest bg-transparent border-0 border-b border-dashed border-slate-500/50 hover:border-slate-500 pb-0.5 outline-none cursor-pointer pr-1 transition-all",
                        isDark ? "text-slate-300 [color-scheme:dark]" : "text-slate-700 bg-white"
                      )}
                      style={{ direction: language === 'ar' ? 'rtl' : 'ltr' }}
                    >
                      {entries.map((entry) => (
                        <option 
                          key={entry.id} 
                          value={entry.id}
                          className={isDark ? "bg-slate-950 text-white" : "bg-white text-slate-900"}
                        >
                          {entry.month} {entry.year} ({(entry.expenses || []).length} {language === 'ar' ? 'مصروف' : 'Expenses'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddingExpense(true)}
                  className="w-14 h-14 bg-white text-black rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl shadow-white/10"
                >
                  <PlusCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 {/* Right Column (Analysis) */}
                 <div className="space-y-6 lg:order-2">
                    {/* Financial Analysis Card */}
                    <div className={cn(
                       "rounded-[32px] p-6 border transition-all",
                       isDark ? "bg-white/5 border-white/10 shadow-inner" : "bg-slate-50 border-slate-200 shadow-sm"
                    )}>
                     <div className="flex items-center gap-3 mb-8">
                        <div className={cn(
                           "w-10 h-10 rounded-xl flex items-center justify-center",
                           isDark ? "bg-white/5" : "bg-slate-100"
                        )}>
                           <LucidePieChart className="w-5 h-5 text-slate-500" />
                        </div>
                        <h3 className={cn("text-xl font-black italic uppercase tracking-tighter", isDark ? "text-white" : "text-slate-900")}>
                           {language === 'ar' ? 'تحليل المصروفات' : 'Expense Analysis'}
                        </h3>
                     </div>

                     <div className="space-y-10">
                        {/* Category Mix */}
                        <div>
                           <div className="flex justify-between items-center mb-6">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{language === 'ar' ? 'حسب المصروف' : 'By Item'}</span>
                              <div className="text-[10px] font-black text-brand-yellow uppercase">
                                 {language === 'ar' ? 'الإجمالي: ' : 'Total: '} {selectedEntry?.expensesTotal.toLocaleString()} EGP
                              </div>
                           </div>
                           <div className="w-full h-80 mb-10">
                             {selectedEntry?.expenseChartData && selectedEntry.expenseChartData.length > 0 ? (
                               <ResponsiveContainer width="100%" height="100%">
                                 <PieChart margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
                                   <Pie
                                     data={selectedEntry.expenseChartData}
                                     cx="50%"
                                     cy="50%"
                                     innerRadius={45}
                                     outerRadius={65}
                                     paddingAngle={1}
                                     dataKey="value"
                                     stroke="none"
                                     labelLine={{ stroke: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)', strokeWidth: 1.5 }}
                                     label={({ name, percentage, cx, x, y, index }: any) => {
                                       const isRight = x > cx;
                                       const truncatedName = name.length > 20 ? name.substring(0, 17) + '..' : name;
                                       
                                       return (
                                         <text 
                                           x={x} 
                                           y={y} 
                                           fill={isDark ? "#fff" : "#1e293b"} 
                                           textAnchor={isRight ? 'start' : 'end'} 
                                           dominantBaseline="central"
                                           className="text-[8px] font-black uppercase"
                                         >
                                           {`${truncatedName} (${percentage}%)`}
                                         </text>
                                       );
                                     }}
                                   >
                                     {selectedEntry.expenseChartData.map((entry: any, index: number) => (
                                       <Cell 
                                         key={`cell-${index}`} 
                                         fill={entry.fill} 
                                         className="outline-none"
                                       />
                                     ))}
                                     <Label 
                                       value={selectedEntry.expensesTotal.toLocaleString()} 
                                       position="center"
                                       fill={isDark ? "#fff" : "#0f172a"}
                                       style={{ fontSize: '18px', fontWeight: '900' }}
                                     />
                                   </Pie>
                                   <Tooltip 
                                     contentStyle={{ 
                                        backgroundColor: isDark ? '#000' : '#fff', 
                                        border: 'none', 
                                        borderRadius: '16px',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                                     }}
                                     itemStyle={{ color: isDark ? '#fff' : '#000', fontSize: '10px', fontWeight: 'bold' }}
                                   />
                                 </PieChart>
                               </ResponsiveContainer>
                             ) : (
                               <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                                     <LucidePieChart className="w-6 h-6 opacity-30" />
                                  </div>
                                  <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'ar' ? 'لا توجد بيانات' : 'No Data Available'}</span>
                               </div>
                             )}
                           </div>
                        </div>

                        <div className="flex flex-col">
                           <div className="flex justify-between items-center mb-6">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                {filterCategory 
                                  ? (language === 'ar' ? `مصروفات ${EXPENSE_CATEGORIES.find(c => c.id === filterCategory)?.label}` : `${EXPENSE_CATEGORIES.find(c => c.id === filterCategory)?.labelEn} Expenses`)
                                  : (language === 'ar' ? 'تفاصيل المصروفات' : 'Expense Breakdown')
                                }
                              </span>
                           </div>
                           
                           <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                              {(selectedEntry?.itemAnalysisData || [])
                                .filter(item => !filterCategory || item.category === filterCategory)
                                .map((item, idx) => {
                                 const category = EXPENSE_CATEGORIES.find(c => c.id === item.category);
                                 const Icon = (category as any)?.icon || LayoutGrid;
                                 return (
                                    <div 
                                       key={idx}
                                       className={cn(
                                          "p-4 rounded-2xl border flex items-center justify-between transition-all group",
                                          isDark ? "bg-white/3 border-white/5 hover:bg-white/5" : "bg-slate-50 border-slate-100 hover:bg-white"
                                       )}
                                    >
                                       <div className="flex items-center gap-3">
                                          <div 
                                             className="w-8 h-8 rounded-lg flex items-center justify-center"
                                             style={{ backgroundColor: (category?.color || '#94a3b8') + '20' }}
                                          >
                                             <Icon className="w-4 h-4" style={{ color: category?.color || '#94a3b8' }} />
                                          </div>
                                          <div className="overflow-hidden">
                                             <div className={cn("text-[10px] font-black uppercase truncate max-w-[100px] sm:max-w-[150px]", isDark ? "text-white" : "text-slate-900")}>
                                                {item.name}
                                             </div>
                                             <div className="text-[8px] font-bold text-slate-500 uppercase tracking-tight">
                                                {language === 'ar' ? category?.label : category?.labelEn}
                                             </div>
                                          </div>
                                       </div>
                                       <div className="text-right flex-shrink-0">
                                          <div className={cn("text-[11px] font-black italic", isDark ? "text-white" : "text-slate-900")}>
                                             {item.value.toLocaleString()} <span className="text-[8px] opacity-70">EGP</span>
                                          </div>
                                          <div className="text-[8px] font-bold text-slate-500 uppercase">
                                             {((item.value / (selectedEntry?.expensesTotal || 1)) * 100).toFixed(0)}%
                                          </div>
                                       </div>
                                    </div>
                                 );
                              })}
                              
                              {(selectedEntry?.itemAnalysisData || []).length === 0 && (
                                 <div className="text-center py-8 opacity-50">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                       {language === 'ar' ? 'لا توجد بيانات للتحليل' : 'No data to analyze'}
                                    </span>
                                 </div>
                              )}
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* AI Analysis Quick Tip */}
                  <div className="glass rounded-[32px] p-6 border-white/20 bg-white/5 relative overflow-hidden group">
                     <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all" />
                     <motion.div 
                       animate={{ rotate: [0, 5, -5, 0] }}
                       transition={{ repeat: Infinity, duration: 5 }}
                       className="relative z-10 space-y-4"
                     >
                        <div className="flex items-center gap-2">
                           <Sparkles className="w-4 h-4 text-emerald-400" />
                           <span className={cn("text-[10px] font-black uppercase tracking-widest", isDark ? "text-white" : "text-slate-900")}>{language === 'ar' ? 'تحليل ذكي فوري' : 'Live AI Insight'}</span>
                        </div>
                        <div className="text-[11px] leading-relaxed text-slate-400 font-medium">
                          {isLoadingInsight ? (
                            <div className="flex items-center gap-2 animate-pulse">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>{language === 'ar' ? 'جاري التحليل...' : 'Analyzing...'}</span>
                            </div>
                          ) : (
                            aiInsight || (selectedEntry?.expenses?.length && selectedEntry.expenses.length > 0 
                              ? (language === 'ar' 
                                  ? "بناءً على مشترياتك الأخيرة، سيعطيك هذا القسم نصائح مخصصة قريباً."
                                  : "Based on your recent purchases, this section will provide personalized tips soon.")
                              : (language === 'ar'
                                  ? "سجل مصروفاتك اليومية هنا وسأقوم بتحويلها لبيانات مالية مفيدة لك."
                                  : "Add your daily expenses here and I will transform them into actionable financial insights."))
                          )}
                        </div>
                      </motion.div>
                   </div>

                   {/* Smart AI Input */}
                   <div className="mt-6">
                      <form 
                        onSubmit={handleSmartAdd}
                        className={cn(
                          "relative group transition-all duration-500",
                          isDark ? "bg-white/5 border-white/5" : "bg-white border-slate-100",
                          "rounded-[32px] border p-2"
                        )}
                      >
                         <input 
                           type="text"
                           value={smartInput}
                           onChange={(e) => setSmartInput(e.target.value)}
                           placeholder={language === 'ar' ? 'أضف مصروف بالذكاء الاصطناعي (مثال: ٥٠ جنيه فطار)' : 'Add with AI (e.g. 50 egp breakfast)'}
                           className={cn(
                             "w-full bg-transparent p-4 pr-14 text-sm font-bold outline-none",
                             isDark ? "text-white placeholder:text-slate-600" : "text-slate-900 placeholder:text-slate-400"
                           )}
                           disabled={isSmartLoading}
                         />
                         <button 
                           type="submit"
                           disabled={isSmartLoading || !smartInput.trim()}
                           className={cn(
                             "absolute right-3 top-3 w-10 h-10 rounded-2xl flex items-center justify-center transition-all",
                             isSmartLoading ? "bg-slate-800" : (smartInput.trim() ? "bg-brand-yellow text-black shadow-lg shadow-brand-yellow/20" : "bg-white/5 text-slate-500")
                           )}
                         >
                            {isSmartLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                         </button>
                      </form>
                   </div>
                </div>

               {/* Left Column (Transactions) */}
                <div className="lg:col-span-2 space-y-6 lg:order-1">
                  {/* Summary Bar */}
                  <div className={cn(
                    "p-6 rounded-3xl border flex items-center justify-between",
                    isDark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"
                  )}>
                     <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{language === 'ar' ? 'إجمالي المصاريف' : 'Total Spent'}</div>
                        <div className={cn("text-4xl font-black text-white italic transition-all duration-500", !showValues && "blur-xl opacity-30")}>
                          {(selectedEntry?.expensesTotal || 0).toLocaleString()} <span className="text-sm">EGP</span>
                        </div>
                     </div>
                     <div className="text-right space-y-1">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{language === 'ar' ? 'الميزانية التقريبية' : 'Approx. Budget'}</div>
                        <div className={cn("text-xl font-bold italic", isDark ? "text-slate-400" : "text-slate-600")}>
                           {selectedEntry?.expensesTotal.toLocaleString()} <span className="text-xs">EGP</span>
                        </div>
                     </div>
                  </div>

                  {/* List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{language === 'ar' ? 'آخر المعاملات' : 'Recent Transactions'}</h3>
                    </div>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                      {selectedEntry?.expenses && selectedEntry.expenses.length > 0 ? (
                        [...selectedEntry.expenses].reverse().map(expense => (
                          <div 
                            key={expense.id} 
                            className={cn(
                              "flex sm:items-center justify-between p-3.5 sm:p-5 border rounded-2xl group transition-all gap-3 flex-col sm:flex-row",
                              isDark ? "bg-white/2 border-white/5 hover:border-white/10 hover:bg-white/5 shadow-inner" : "bg-white border-slate-100 hover:border-slate-200 shadow-sm"
                            )}
                          >
                             <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                <div className={cn(
                                  "w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-colors shadow-sm shrink-0",
                                  isDark ? "bg-white/10 text-white" : "bg-slate-100 text-slate-500"
                                )}>
                                   {(() => {
                                      const autoCatId = getAutoCategory(expense.description, (expense as any).category);
                                      const cat = EXPENSE_CATEGORIES.find(c => c.id === autoCatId);
                                      const Icon = (cat as any)?.icon || LayoutGrid;
                                      return <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: cat?.color || '#94a3b8' }} />;
                                   })()}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                   <div className={cn("text-[10px] sm:text-xs font-black truncate max-w-full", isDark ? "text-white" : "text-slate-900")}>{expense.description}</div>
                                   <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                      <div className="text-[8px] sm:text-[9px] text-slate-500 font-bold uppercase tracking-widest whitespace-nowrap">
                                         {(() => {
                                             const autoCatId = getAutoCategory(expense.description, (expense as any).category);
                                              const cat = EXPENSE_CATEGORIES.find(c => c.id === autoCatId);
                                              if (!cat) return autoCatId;
                                              return language === 'ar' ? cat?.label : cat?.labelEn;
                                           })()}
                                      </div>
                                      {(expense as any).installmentInfo && (
                                        <>
                                          <div className="w-0.5 h-0.5 rounded-full bg-slate-700 opacity-30" />
                                          <div className="text-[7px] sm:text-[8px] font-black bg-brand-yellow/10 text-brand-yellow px-1 py-0.5 rounded-md border border-brand-yellow/20">
                                            {language === 'ar' ? 'قسط' : 'Inst.'} {(expense as any).installmentInfo.current}/{(expense as any).installmentInfo.total}
                                          </div>
                                        </>
                                      )}
                                   </div>
                                </div>
                             </div>
                             <div className="flex items-center gap-3 sm:gap-4 justify-between sm:justify-end mt-1 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-white/5">
                                <div className={cn(
                                  "text-sm sm:text-base font-black transition-all duration-500",
                                  isDark ? "text-white" : "text-slate-900",
                                  !showValues && "blur-md opacity-30"
                                )}>
                                  {(expense.amount || 0).toLocaleString()} <span className="text-[10px] opacity-40">EGP</span>
                                </div>
                                <button 
                                  onClick={() => handleDeleteExpense(expense.id, (expense as any).recurringId)}
                                  className={cn(
                                    "p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all",
                                    isDark ? "text-slate-600 hover:text-brand-red" : "text-slate-400 hover:text-red-500"
                                  )}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                             </div>
                          </div>
                        ))
                      ) : (
                        <div className={cn(
                          "py-20 flex flex-col items-center justify-center border-2 border-dashed rounded-[32px]",
                          isDark ? "opacity-30 text-slate-400 border-white/5" : "text-slate-300 border-slate-100"
                        )}>
                           <LayoutDashboard className="w-16 h-16 mb-4" />
                           <p className="text-xs font-bold uppercase tracking-widest">{language === 'ar' ? 'سجل مصاريفك لتبدأ التحليل' : 'Log expenses to start analyzing'}</p>
                        </div>
                      )}
                    </div>
                 </div>
               </div>
            </div>

            {/* Monthly Planning Table Section */}
            <div className={cn(
              "rounded-[40px] p-8 border overflow-hidden transition-all duration-500",
              isDark ? "glass border-white/10" : "bg-white border-slate-200 shadow-sm"
            )}>
                 <h3 className={cn(
                   "text-xl font-black italic uppercase tracking-tighter mb-6",
                   isDark ? "text-white" : "text-slate-900"
                 )}>
                   {language === 'ar' ? 'سجل الخطة الشهرية' : 'Monthly Planning Record'}
                 </h3>
                 <div className="overflow-x-auto">
                   <table className={cn(
                     "w-full text-right border-collapse",
                     isDark ? "text-white" : "text-slate-900"
                   )}>
                     <thead>
                       <tr className={cn(
                         "border-b text-[10px] font-bold uppercase tracking-widest text-right",
                         isDark ? "border-white/10 text-slate-500" : "border-slate-200 text-slate-500"
                       )}>
                         <th className="pb-4 pr-4">{language === 'ar' ? 'الشهر' : 'Month'}</th>
                         <th className="pb-4 px-4">{language === 'ar' ? 'الصافي (فعلي)' : 'Net (Actual)'}</th>
                         <th className="pb-4 px-4">{language === 'ar' ? 'المستهدف' : 'Target'}</th>
                         <th className="pb-4 px-4">{language === 'ar' ? 'تراكمي فعلي' : 'Cumul. Actual'}</th>
                         <th className="pb-4 px-4">{language === 'ar' ? 'تراكمي مخطط' : 'Cumul. Target'}</th>
                         <th className="pb-4 pl-4 text-left">{language === 'ar' ? 'المصروفات' : 'Expenses'}</th>
                       </tr>
                     </thead>
                     <tbody className="text-[11px] font-bold">
                       {stats?.computedEntries.map((entry) => (
                         <tr 
                           key={entry.id} 
                           onClick={() => setSelectedMonthId(entry.id)}
                           className={cn(
                             "border-b transition-colors cursor-pointer group",
                             isDark ? "border-white/5 hover:bg-white/5" : "border-slate-100 hover:bg-slate-50 hover:border-slate-200",
                             entry.id === selectedMonthId && (isDark ? "bg-white/10" : "bg-slate-100")
                           )}
                         >
                           <td className={cn(
                             "py-4 pr-4 font-black uppercase italic font-sans",
                             isDark ? "text-white group-hover:text-brand-yellow" : "text-slate-900 group-hover:text-brand-yellow"
                           )}>{entry.month} {entry.year}</td>
                           <td className={cn(
                             "py-4 px-4 font-black italic",
                             isDark ? "text-white" : "text-slate-900",
                             !showValues && "blur-sm"
                           )}>
                             {(entry.actualSalary + entry.actualUber - entry.expensesTotal).toLocaleString()}
                           </td>
                           <td className={cn("py-4 px-4 font-bold text-slate-500", !showValues && "blur-sm")}>
                             {(entry.plannedSalary + entry.plannedUber).toLocaleString()}
                           </td>
                           <td className={cn("py-4 px-4 font-black italic", isDark ? "text-white" : "text-slate-900", !showValues && "blur-sm")}>
                             {(entry.cumulativeCash || 0).toLocaleString()}
                           </td>
                           <td className={cn("py-4 px-4 font-bold text-slate-500", !showValues && "blur-sm")}>
                             {(entry.cumulativePlanned || 0).toLocaleString()}
                           </td>
                           <td className={cn("py-4 pl-4 text-left", isDark ? "text-slate-300" : "text-slate-600", !showValues && "blur-sm")}>
                             {entry.expensesTotal.toLocaleString()}
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
            </div>
          </motion.div>
        </div>
      ) : currentProject === 'savings' ? (
        <>
           <div className="max-w-7xl mx-auto px-4 space-y-8 mb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
           
           {/* Top Stats Grid */}
           <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 sm:gap-6">
              <StatCard 
                 icon={<Target className="w-5 h-5 text-brand-yellow" />}
                 label={language === 'ar' ? 'إجمالي المدخرات' : 'Total Savings'}
                 value={`${(stats?.currentMonth?.cumulativeCash || 0).toLocaleString()} EGP`}
                 subValue={language === 'ar' ? 'إجمالي ما تم ادخاره حتى الآن' : 'Total saved to date'}
                 highlight
                 isDark={isDark}
                 isBlurred={!showValues}
              />
              <StatCard 
                 icon={<Goal className="w-5 h-5 text-brand-blue" />}
                 label={language === 'ar' ? 'المستهدف الشهري' : 'Month Target'}
                 value={`${(stats?.currentMonth?.monthlySavings || 0).toLocaleString()} / ${(profile?.savingsTarget || 0).toLocaleString()}`}
                 subValue={language === 'ar' 
                   ? `حققت ${(((stats?.currentMonth?.monthlySavings || 0) / (profile?.savingsTarget || 1)) * 100).toFixed(1)}% من هدف الشهر`
                   : `Achieved ${(((stats?.currentMonth?.monthlySavings || 0) / (profile?.savingsTarget || 1)) * 100).toFixed(1)}% of monthly target`}
                 editable
                 isBlurred={!showValues}
                 isDark={isDark}
                 onClick={() => {
                   setEditingField({ field: 'savingsTarget', label: language === 'ar' ? 'المستهدف' : 'Target' });
                   setEditValue(profile?.savingsTarget?.toString() || '');
                 }}
              />
              <StatCard 
                 icon={<Wallet className="w-5 h-5 text-emerald-400" />}
                 label={language === 'ar' ? 'صافي الراتب' : 'Net Salary'}
                 value={`${(selectedEntry?.actualSalary || 0).toLocaleString()} EGP`}
                 subValue={language === 'ar' ? 'الراتب بعد الخصومات' : 'Salary after deductions'}
                 editable
                 isBlurred={!showValues}
                 isDark={isDark}
                 onClick={() => {
                   setEditingField({ field: 'salary', label: language === 'ar' ? 'الراتب' : 'Salary' });
                   setEditValue(selectedEntry?.actualSalary?.toString() || '');
                 }}
              />
              <StatCard 
                 icon={<Car className="w-5 h-5 text-blue-400" />}
                 label={language === 'ar' ? 'دخل أوبر' : 'Uber Income'}
                 value={`${(selectedEntry?.actualUber || 0).toLocaleString()} EGP`}
                 subValue={language === 'ar' ? 'إجمالي دخل أوبر هذا الشهر' : 'Total Uber income this month'}
                 editable
                 isBlurred={!showValues}
                 isDark={isDark}
                 onClick={() => {
                   setEditingField({ field: 'uberIncome', label: language === 'ar' ? 'دخل أوبر' : 'Uber Income' });
                   setEditValue(selectedEntry?.actualUber?.toString() || '');
                 }}
              />
              <StatCard 
                 icon={<Siren className="w-5 h-5 text-brand-red" />}
                 label={language === 'ar' ? 'صندوق الطوارئ' : 'Emergency Fund'}
                 value={`${(profile?.emergencyFund || 0).toLocaleString()} EGP`}
                 subValue={language === 'ar' ? 'مبلغ احتياطي للحالات الطارئة' : 'Reserve for emergencies'}
                 editable
                 isBlurred={!showValues}
                 isDark={isDark}
                 onClick={() => {
                   setEditingField({ field: 'emergencyFund', label: language === 'ar' ? 'صندوق الطوارئ' : 'Emergency Fund' });
                   setEditValue(profile?.emergencyFund?.toString() || '');
                 }}
              />
              <StatCard 
                 icon={<Coins className="w-5 h-5 text-amber-400" />}
                 label={language === 'ar' ? 'قيمة الذهب الحالي' : 'Gold Value'}
                 value={`${(stats?.currentMonth?.goldValue || 0).toLocaleString()} EGP`}
                 subValue={language === 'ar' ? `بناءً على السعر الحالي` : `Based on current price`}
                 highlight
                 isDark={isDark}
                 isBlurred={!showValues}
              />
           </div>

           {/* Quick Entry / Control Box */}
           <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className={cn(
                 "p-8 border rounded-[40px] transition-all duration-500",
                 isDark ? "glass border-white/10 bg-white/5" : "bg-white border-slate-200 shadow-sm"
               )}
            >
               <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="flex items-center gap-4 min-w-[200px]">
                     <div className="w-12 h-12 rounded-2xl bg-brand-yellow/10 flex items-center justify-center text-brand-yellow">
                        <Zap className="w-6 h-6" />
                     </div>
                     <div>
                        <h3 className={cn("text-xl font-black italic uppercase tracking-tighter", isDark ? "text-white" : "text-slate-900")}>
                           {language === 'ar' ? 'تحديث سريع' : 'QUICK UPDATE'}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{selectedEntry?.month} {selectedEntry?.year}</p>
                     </div>
                  </div>

                  <div className="flex-1 w-full flex gap-3">
                     <button 
                       onClick={() => {
                         if (quickAmount.startsWith('-')) {
                           setQuickAmount(quickAmount.substring(1));
                         } else if (quickAmount !== '') {
                           setQuickAmount('-' + quickAmount);
                         } else {
                           setQuickAmount('-');
                         }
                         vibrate(5);
                       }}
                       className={cn(
                         "h-16 w-16 border-2 rounded-2xl flex items-center justify-center text-xl font-black transition-all flex-shrink-0",
                         isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-100 border-slate-200 text-slate-900"
                       )}
                     >
                       +/-
                     </button>
                     <div className="flex-1 relative">
                        <input 
                           type="text"
                           inputMode="decimal"
                           value={quickAmount}
                           onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || val === '-' || /^-?\d*\.?\d*$/.test(val)) {
                                 setQuickAmount(val);
                              }
                           }}
                           placeholder="0.00"
                           className={cn(
                              "w-full h-16 border-2 rounded-2xl px-6 text-2xl font-black outline-none transition-all",
                              isDark ? "bg-black/40 border-white/10 text-white focus:border-brand-yellow/50" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-brand-yellow/50 shadow-inner"
                           )}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500 uppercase tracking-widest pointer-events-none">
                           EGP
                        </div>
                     </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3">
                     {[
                       { label: language === 'ar' ? 'راتب' : 'Salary', type: 'salary', color: 'bg-emerald-500' },
                       { label: language === 'ar' ? 'أوبر' : 'Uber', type: 'uber', color: 'bg-blue-500' },
                       { label: language === 'ar' ? 'طوارئ' : 'Emergency', type: 'emergency', color: 'bg-brand-red' },
                     ].map((item, idx) => (
                       <button 
                         key={idx}
                         onClick={() => handleQuickUpdate(item.type as any)}
                         className={cn(
                           "px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg",
                           isDark 
                             ? "bg-white/5 border border-white/10 text-white hover:bg-white/10" 
                             : "bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 shadow-slate-100"
                         )}
                       >
                          {item.label}
                       </button>
                     ))}
                  </div>
               </div>
               <div className="mt-4 text-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">
                     {language === 'ar' 
                        ? 'استخدم مبالغ موجبة للإضافة، وسالبة للخصم' 
                        : 'Use positive for addition, negative for subtraction'}
                  </p>
               </div>
           </motion.div>

           {/* Progress Bar */}
           <section className="mb-0 px-0">
             <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">
                <span>{language === 'ar' ? 'تقدم الخطة' : 'Plan Progress'}</span>
                <span>{(stats?.progressPercentage || 0).toFixed(0)}%</span>
             </div>
             <div className={cn(
                "h-1.5 w-full rounded-full overflow-hidden border",
                isDark ? "bg-white/5 border-white/10" : "bg-slate-100 border-slate-200"
              )}>
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${stats?.progressPercentage}%` }}
                   className={cn("h-full", isDark ? "bg-white" : "bg-brand-bg")}
                />
             </div>
             <div className="flex justify-between items-center text-[9px] font-black text-slate-500 mt-3 uppercase tracking-[0.2em]">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-brand-yellow" />
                   <span>{language === 'ar' ? 'المستهدف الإجمالي:' : 'TOTAL TARGET:'} {(profile?.targetCash || 359300).toLocaleString()} EGP</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className={cn("w-2 h-2 rounded-full", isDark ? "bg-white" : "bg-brand-bg")} />
                   <span>{language === 'ar' ? 'المخطط حتى الآن (إكسل):' : 'EXCEL REFERENCE:'} {(selectedEntry?.cumulativePlanned || 0).toLocaleString()} EGP</span>
                </div>
             </div>
           </section>


           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Quick Update & AI Assistant */}
              <div className="lg:col-span-2 space-y-6">
                 {/* Advanced AI Assistant */}
                 <div className={cn(
                    "rounded-[40px] p-8 relative overflow-hidden group min-h-[300px] flex flex-col transition-all",
                    isDark ? "glass border border-white/10 bg-white/5" : "bg-white border border-slate-200 shadow-sm"
                  )}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[100px] pointer-events-none" />
                    <div className="relative z-10 flex flex-col h-full">
                       <div className="flex items-center gap-4 mb-8">
                          <div className={cn(
                            "w-12 h-12 rounded-[20px] shadow-2xl flex items-center justify-center",
                            isDark ? "bg-white text-black" : "bg-slate-900 text-white"
                          )}>
                             <Sparkles className="w-6 h-6" />
                          </div>
                          <div>
                             <h3 className={cn("text-xl font-black italic uppercase tracking-tighter", isDark ? "text-white" : "text-slate-900")}>
                                {language === 'ar' ? 'تحليل ذكي متقدم' : 'Advanced AI Analysis'}
                             </h3>
                             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{language === 'ar' ? 'توصيات مالية مستمرة' : 'Ongoing Recommendations'}</span>
                          </div>
                       </div>
                       
                       <div className={cn("flex-1 text-[13px] leading-relaxed font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
                          {aiLoading ? (
                            <div className="flex items-center gap-2 text-slate-500 py-10 animate-pulse justify-center flex-col">
                               <RefreshCw className="w-8 h-8 animate-spin mb-4" />
                               <span className="text-[10px] font-black uppercase tracking-widest">{language === 'ar' ? 'جاري قراءة البيانات وتوليد التوصيات...' : 'Reading data & generating insights...'}</span>
                            </div>
                          ) : (
                            <div className={cn("markdown-body prose prose-sm max-w-none", isDark ? "prose-invert" : "prose-slate")}>
                              <Markdown>{aiAdvice}</Markdown>
                            </div>
                          )}
                       </div>
                       
                       <button 
                         onClick={() => {
                           setShowAiChat(true);
                           vibrate(5);
                         }}
                         className={cn(
                           "mt-8 w-full py-5 text-[11px] font-black uppercase tracking-widest rounded-[24px] hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl",
                           isDark ? "bg-white text-black" : "bg-slate-900 text-white shadow-slate-200"
                         )}
                       >
                         <MessageCircle className="w-5 h-5" />
                         {language === 'ar' ? 'تحدث مع المساعد المالي' : 'Chat with Financial Assistant'}
                       </button>
                    </div>
                 </div>
              </div>

              {/* Right Sidebar: Gold Portfolio */}
              <div className="lg:col-span-1 space-y-6">
                 <div className={cn("rounded-[40px] p-8 border h-full flex flex-col justify-between group transition-all", isDark ? "glass border-white/10" : "bg-white border-slate-200 shadow-sm")}>
                    <div className="text-center space-y-4">
                       <div className={cn(
                         "mb-6 relative w-24 h-24 rounded-[32px] flex items-center justify-center shadow-2xl mx-auto rotate-3 group-hover:rotate-6 transition-transform",
                         isDark ? "bg-gradient-to-tr from-slate-200 to-white" : "bg-slate-900"
                       )}>
                          <Coins className={cn("w-12 h-12", isDark ? "text-black" : "text-brand-yellow")} />
                          <div className={cn(
                            "absolute -top-2 -right-2 w-8 h-8 text-[10px] font-black flex items-center justify-center rounded-xl border",
                            isDark ? "bg-black text-white border-white/20" : "bg-white text-slate-900 border-slate-200"
                          )}>
                             {(stats?.totalGoldLogged || 0).toFixed(1)}
                          </div>
                       </div>
                       <h3 className={cn("text-2xl font-black italic uppercase tracking-tighter", isDark ? "text-white" : "text-slate-900")}>
                          {language === 'ar' ? 'محفظة الذهب' : 'Gold Wallet'}
                       </h3>
                       <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                          {language === 'ar' ? 'تحوط مالي ضد التضخم' : 'Inflation Hedge Asset'}
                       </p>
                    </div>

                    <div className={cn("rounded-3xl p-6 border space-y-4 mt-8", isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100")}>
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{language === 'ar' ? 'السعر الحالي' : 'Live Price'}</span>
                          <span className="text-xs font-black italic text-brand-yellow">
                             {currentGoldPrice.toLocaleString()} EGP
                          </span>
                       </div>
                       <div className={cn("h-px w-full", isDark ? "bg-white/5" : "bg-slate-200")} />
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{language === 'ar' ? 'القيمة الإجمالية' : 'Total Asset'}</span>
                          <span className={cn("text-xl font-black italic transition-all duration-500", isDark ? "text-white" : "text-slate-900", !showValues && "blur-md opacity-30")}>
                             {(stats?.currentMonth?.goldValue || 0).toLocaleString()} EGP
                          </span>
                       </div>
                    </div>

                    <button 
                      onClick={() => {
                        setIsAddingGoldLog(true);
                        vibrate(5);
                      }}
                      className={cn(
                        "mt-8 w-full py-5 text-[11px] font-black uppercase tracking-widest rounded-[24px] transition-all flex items-center justify-center gap-2 group-hover:border-slate-400 font-sans",
                        isDark ? "bg-white/5 border border-white/10 text-white hover:bg-white/10" : "bg-white border border-slate-200 text-slate-900 hover:bg-slate-50"
                      )}
                    >
                       <PlusCircle className="w-5 h-5 text-brand-yellow" />
                       {language === 'ar' ? 'إضافة ذهب جديد' : 'Log New Gold'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
        </>
      ) : currentProject === 'settings' ? (
        <div className="max-w-4xl mx-auto px-4 space-y-8 mb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className={cn("rounded-[40px] p-8 border transition-all duration-500", isDark ? "glass border-white/10" : "bg-white border-slate-200 shadow-sm")}>
               <div className="flex items-center gap-4 mb-12">
                  <div className={cn(
                    "w-16 h-16 rounded-[24px] flex items-center justify-center border shadow-inner transition-all duration-500",
                    isDark ? "bg-white/5 text-white border-white/10" : "bg-slate-100 text-slate-900 border-slate-200"
                  )}>
                     <Settings className="w-8 h-8" />
                  </div>
                  <div>
                     <h2 className={cn("text-4xl font-black italic uppercase tracking-tighter", isDark ? "text-white" : "text-slate-900")}>{language === 'ar' ? 'الإعدادات' : 'Settings'}</h2>
                     <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">{language === 'ar' ? 'تخصيص الواجهة والنظام' : 'System & UI preferences'}</p>
                  </div>
               </div>

               <div className="space-y-12">
                  {/* Language Section */}
                  <div className="space-y-4">
                     <div className="flex items-center gap-2 mb-2">
                        <Languages className="w-4 h-4 text-blue-400" />
                        <span className={cn("text-[10px] font-black uppercase tracking-widest", isDark ? "text-slate-500" : "text-slate-400")}>
                           {language === 'ar' ? 'لغة النظام' : 'SYSTEM LANGUAGE'}
                        </span>
                     </div>
                     <button 
                        onClick={() => {
                          setLanguage(language === 'ar' ? 'en' : 'ar');
                          vibrate(5);
                        }}
                        className={cn(
                          "w-full p-8 border rounded-[32px] flex items-center gap-6 transition-all group relative overflow-hidden",
                          isDark ? "bg-white/3 border-white/5 hover:bg-white/5 hover:border-white/20" : "bg-slate-50 border-slate-100 hover:bg-white hover:border-slate-200"
                        )}
                     >
                        <div className={cn(
                          "w-14 h-14 rounded-[20px] flex items-center justify-center transition-transform group-hover:scale-110",
                          isDark ? "bg-white/5" : "bg-white shadow-sm"
                        )}>
                           <Languages className="w-7 h-7 text-blue-400" />
                        </div>
                        <div className="text-left flex-1 font-sans">
                           <div className={cn("text-lg font-black italic uppercase mb-1", isDark ? "text-white" : "text-slate-900")}>
                              {language === 'ar' ? 'تغيير اللغة' : 'Change Language'}
                           </div>
                           <div className={cn("text-[10px] font-black uppercase inline-block px-3 py-1 rounded-full", isDark ? "text-slate-500 bg-white/10" : "text-slate-400 bg-slate-100")}>
                              {language === 'ar' ? 'ENGLISH VERSION' : 'النسخة العربية'}
                           </div>
                        </div>
                        <ArrowRight className={cn("w-6 h-6 transition-all group-hover:translate-x-2", isDark ? "text-white/20" : "text-slate-300")} />
                     </button>
                  </div>

                  {/* Themes Section */}
                  <div className="space-y-6">
                     <div className="flex items-center gap-2 mb-2">
                        <Palette className="w-4 h-4 text-brand-yellow" />
                        <span className={cn("text-[10px] font-black uppercase tracking-widest", isDark ? "text-slate-500" : "text-slate-400")}>
                           {language === 'ar' ? 'سمات التصميم' : 'INTERFACE THEMES'}
                        </span>
                     </div>
                     
                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                           { id: 'royal', name: 'Royal Gold', nameAr: 'الملكي الذهبي', bg: '#000000', primary: '#d4af37' },
                           { id: 'light', name: 'Pure Light', nameAr: 'فجر ناصع', bg: '#ffffff', primary: '#0f172a' },
                           { id: 'midnight', name: 'Midnight', nameAr: 'منتصف الليل', bg: '#020617', primary: '#3b82f6' },
                           { id: 'nebula', name: 'Nebula', nameAr: 'سديم الأرجوان', bg: '#0f0114', primary: '#d946ef' },
                           { id: 'mint', name: 'Mint Leaf', nameAr: 'نعناع منعش', bg: '#050f0d', primary: '#10b981' },
                           { id: 'lava', name: 'Lava Flow', nameAr: 'صهارة بركانية', bg: '#0c0c0c', primary: '#f97316' },
                           { id: 'aurora', name: 'Aurora', nameAr: 'شفق قطبي', bg: '#05191c', primary: '#2dd4bf' },
                           { id: 'coffee', name: 'Coffee', nameAr: 'قهوة اسبريسو', bg: '#fdfaf6', primary: '#b45309' },
                           { id: 'slate', name: 'Slate', nameAr: 'حجر رمادي', bg: '#f8fafc', primary: '#64748b' },
                        ].map((t) => (
                           <button
                              key={t.id}
                              onClick={() => {
                                 setTheme(t.id as any);
                                 localStorage.setItem('app-theme', t.id);
                                 vibrate(10);
                              }}
                              className={cn(
                                 "relative p-4 rounded-3xl border transition-all h-32 flex flex-col justify-between overflow-hidden group",
                                 theme === t.id 
                                    ? "border-brand-yellow ring-4 ring-brand-yellow/20 scale-[0.98]" 
                                    : (isDark ? "bg-white/3 border-white/5 hover:border-white/20" : "bg-white border-slate-200 hover:border-brand-yellow/30 shadow-sm")
                              )}
                           >
                              <div 
                                 className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity"
                                 style={{ backgroundColor: t.bg }}
                              />
                              <div className="relative z-10 flex flex-col h-full justify-between font-sans">
                                 <div className="flex justify-between items-start">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: t.primary }}>
                                       <Palette className={cn("w-4 h-4", (t.id === 'light' || t.id === 'nordic' || t.id === 'sepia') ? "text-slate-900" : "text-white")} />
                                    </div>
                                    {theme === t.id && (
                                       <div className="w-5 h-5 bg-brand-yellow rounded-full flex items-center justify-center animate-in zoom-in duration-300 shadow-xl border border-black/10">
                                          <CheckCircle2 className="w-3 h-3 text-black" />
                                       </div>
                                    )}
                                 </div>
                                 <div className="text-left">
                                    <div className={cn("text-[10px] font-black uppercase tracking-tighter leading-tight", isDark ? "text-white" : "text-slate-900")}>
                                       {language === 'ar' ? t.nameAr : t.name}
                                    </div>
                                 </div>
                              </div>
                           </button>
                        ))}
                     </div>
                  </div>

                  {/* Data Converter & Import Section */}
                  <div className="space-y-4 font-sans mb-12">
                     <div className="flex items-center gap-2 mb-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        <span className={cn("text-[10px] font-black uppercase tracking-widest", isDark ? "text-slate-500" : "text-slate-400")}>
                           {language === 'ar' ? 'استيراد وتحويل البيانات' : 'DATA CONVERTER & IMPORT'}
                        </span>
                     </div>
                     <button 
                        onClick={() => {
                          setCurrentProject('converter');
                          vibrate(5);
                        }}
                        className={cn(
                          "w-full p-8 border rounded-[32px] flex items-center gap-6 transition-all group relative overflow-hidden",
                          isDark ? "bg-white/3 border-white/5 hover:bg-white/5 hover:border-white/20" : "bg-slate-50 border-slate-100 hover:bg-white hover:border-slate-200"
                        )}
                      >
                         <div className={cn(
                           "w-14 h-14 rounded-[20px] flex items-center justify-center transition-transform group-hover:scale-110",
                           isDark ? "bg-white/5 text-emerald-400" : "bg-white text-emerald-600 shadow-sm"
                         )}>
                            <FileSpreadsheet className="w-7 h-7" />
                         </div>
                         <div className="text-left flex-1 font-sans">
                            <div className={cn("text-lg font-black italic uppercase mb-1", isDark ? "text-white" : "text-slate-900")}>
                               {language === 'ar' ? 'تحميل كشف الحساب والملفات' : 'Statement & File Converter'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase mt-1 leading-snug">
                               {language === 'ar' ? 'تحويل كلي للمصروفات والذهب والنسخ الاحتياطي في الوقت الحقيقي' : 'Convert CSV, Excel bank exports, or restore JSON archives with real-time tracking'}
                            </div>
                         </div>
                         <ArrowRight className={cn("w-6 h-6 transition-all group-hover:translate-x-2", isDark ? "text-white/20" : "text-slate-300")} />
                      </button>
                  </div>

                  <div className="mt-8">
                     <button 
                        onClick={logout}
                        className="w-full p-8 border border-brand-red/20 bg-brand-red/5 rounded-[32px] flex items-center justify-between hover:bg-brand-red/10 transition-all group overflow-hidden relative"
                     >
                        <div className="absolute right-0 top-0 w-32 h-32 bg-brand-red/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                        <div className="flex items-center gap-6 relative z-10">
                           <div className="w-14 h-14 bg-brand-red/10 rounded-[20px] flex items-center justify-center">
                              <LogOut className="w-8 h-8 text-brand-red" />
                           </div>
                           <div className="text-left font-sans">
                              <div className="text-lg font-black italic uppercase text-brand-red leading-none">{language === 'ar' ? 'تسجيل الخروج' : 'Logout Session'}</div>
                              <div className="text-[10px] font-bold text-brand-red/50 uppercase tracking-widest mt-1">{language === 'ar' ? 'إنهاء الجلسة الحالية أمنياً' : 'Terminate current secure session'}</div>
                           </div>
                        </div>
                        <ArrowRight className="w-6 h-6 text-brand-red opacity-50 group-hover:translate-x-3 transition-all relative z-10" />
                     </button>
                  </div>

                  <div className="mt-4">
                     <button 
                        onClick={handleResetData}
                        className="w-full p-8 border border-red-500/20 bg-red-500/5 rounded-[32px] flex items-center justify-between hover:bg-red-500/10 transition-all group overflow-hidden relative"
                     >
                        <div className="absolute right-0 top-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                        <div className="flex items-center gap-6 relative z-10">
                           <div className="w-14 h-14 bg-red-500/10 rounded-[20px] flex items-center justify-center">
                              <RotateCcw className="w-8 h-8 text-red-500" />
                           </div>
                           <div className="text-left font-sans">
                              <div className="text-lg font-black italic uppercase text-red-500 leading-none">{language === 'ar' ? 'إعادة ضبط البيانات والمدخرات' : 'Reset Data & Savings'}</div>
                              <div className="text-[10px] font-bold text-red-500/50 uppercase tracking-widest mt-1">{language === 'ar' ? 'مسح كل المعاملات والمدخرات والبدء من جديد' : 'Wipe all transaction logs, savings and start over'}</div>
                           </div>
                        </div>
                        <ArrowRight className="w-6 h-6 text-red-500 opacity-50 group-hover:translate-x-3 transition-all relative z-10" />
                     </button>
                  </div>
               </div>
            </div>
         </div>
      ) : (
        currentProject === 'converter' ? (
          <FileConverter
            user={user}
            db={db}
            profile={profile}
            entries={entries}
            language={language}
            isDark={isDark}
            setCurrentProject={setCurrentProject}
          />
        ) : (
          <div className="hidden" />
        )
      )}



      {/* Update Modals */}
      <AnimatePresence>
        {isAddingGoldLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsAddingGoldLog(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={cn(
              "w-full max-w-lg rounded-[40px] border relative z-10 overflow-hidden",
              isDark ? "glass border-white/10" : "bg-white border-slate-200 shadow-2xl"
            )}
          >
             <div className="p-8">
                <div className="flex items-center gap-4 mb-8">
                   <div className="w-12 h-12 rounded-2xl bg-amber-400/10 flex items-center justify-center">
                      <Coins className="w-6 h-6 text-amber-400" />
                   </div>
                   <div>
                      <h3 className={cn("text-2xl font-black italic uppercase tracking-tighter", isDark ? "text-white" : "text-slate-900")}>
                        {language === 'ar' ? 'إضافة ذهب' : 'Add Gold Log'}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{language === 'ar' ? 'سجل عملية شراء جديدة' : 'Record a new purchase'}</p>
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-2">{language === 'ar' ? 'الوزن (جرام)' : 'Weight (Grams)'}</label>
                      <input 
                        type="number"
                        placeholder="0.00"
                        value={newGoldLog.weight}
                        onChange={(e) => setNewGoldLog({ ...newGoldLog, weight: e.target.value })}
                        className={cn("w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-lg font-black italic focus:border-brand-yellow outline-none transition-all", isDark ? "text-white" : "bg-slate-50 border-slate-200 text-slate-900")}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-2">{language === 'ar' ? 'سعر الجرام (اختياري)' : 'Price per Gram (Optional)'}</label>
                      <input 
                        type="number"
                        placeholder={currentGoldPrice.toString()}
                        value={newGoldLog.price}
                        onChange={(e) => setNewGoldLog({ ...newGoldLog, price: e.target.value })}
                        className={cn("w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-lg font-black italic focus:border-brand-yellow outline-none transition-all", isDark ? "text-white" : "bg-slate-50 border-slate-200 text-slate-900")}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-2">{language === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                      <input 
                        type="text"
                        placeholder="..."
                        value={newGoldLog.notes}
                        onChange={(e) => setNewGoldLog({ ...newGoldLog, notes: e.target.value })}
                        className={cn("w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-sm font-bold focus:border-brand-yellow outline-none transition-all", isDark ? "text-white" : "bg-slate-50 border-slate-200 text-slate-900")}
                      />
                   </div>
                   
                   <div className="flex gap-4 pt-4">
                      <button 
                        onClick={handleAddGoldLog}
                        className="flex-1 bg-brand-yellow text-black py-5 rounded-3xl font-black italic text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-brand-yellow/20"
                      >
                         {language === 'ar' ? 'تأكيد الإضافة' : 'Confirm Addition'}
                      </button>
                      <button 
                        onClick={() => setIsAddingGoldLog(false)}
                        className="px-8 rounded-3xl bg-white/5 text-slate-500 font-black italic uppercase text-sm hover:bg-white/10 transition-all"
                      >
                         {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                   </div>
                </div>
             </div>
          </motion.div>
        </div>
        )}
        {editingField && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setEditingField(null)}
               className="fixed inset-0 bg-black/80 backdrop-blur-sm"
             />
             <div className="min-h-full flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative glass max-w-sm w-full p-8 rounded-[40px] shadow-2xl border border-white/10 bg-brand-bg"
                >
                   <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-brand-yellow/10 flex items-center justify-center text-brand-yellow">
                         <Pencil className="w-5 h-5" />
                      </div>
                      <h3 className="text-xl font-black">{editingField.label}</h3>
                   </div>
                   
                   <div className="space-y-6">
                      <div className="space-y-2">
                         <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">{language === 'ar' ? 'القيمة الجديدة (ج.م.)' : 'New Value (EGP)'}</label>
                         <input 
                           autoFocus
                           type="number"
                           value={editValue}
                           onChange={(e) => setEditValue(e.target.value)}
                           className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-3xl font-black text-center focus:border-brand-yellow outline-none"
                         />
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                         {[-1000, -500, 500, 1000, 2000, 5000].map(val => (
                           <button 
                             key={val}
                             onClick={() => setEditValue((Number(editValue) + val).toString())}
                             className="py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black hover:bg-white/10 transition-all"
                           >
                             {val > 0 ? '+' : ''}{val.toLocaleString()}
                           </button>
                         ))}
                      </div>

                      <div className="flex gap-3 mt-8">
                         <button 
                           onClick={handleUpdateField}
                           className="flex-1 bg-white text-black py-4 rounded-2xl font-black hover:opacity-90 transition-all active:scale-95"
                         >
                           {language === 'ar' ? 'حفظ' : 'Save'}
                         </button>
                         <button 
                           onClick={() => setEditingField(null)}
                           className="px-6 py-4 rounded-2xl bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-all"
                         >
                           {language === 'ar' ? 'إلغاء' : 'Cancel'}
                         </button>
                      </div>
                   </div>
                </motion.div>
             </div>
          </div>
        )}
        {(isEditingUber || isEditingEmergency || isEditingSalary) && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => { setIsEditingUber(false); setIsEditingEmergency(false); setIsEditingSalary(false); }}
               className="fixed inset-0 bg-black/80 backdrop-blur-sm"
             />
             <div className="min-h-full flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative glass max-w-sm w-full p-8 rounded-[40px] shadow-2xl border border-brand-border"
                >
                   <h3 className="text-xl font-black mb-1">
                     {isEditingUber 
                       ? (language === 'ar' ? 'تعديل دخل أوبر' : 'Edit Uber Income') 
                       : isEditingSalary 
                         ? (language === 'ar' ? 'تعديل صافي الراتب' : 'Edit Net Salary') 
                         : (language === 'ar' ? 'تعديل صندوق الطوارئ' : 'Edit Emergency Fund')}
                   </h3>
                   <p className="text-xs text-slate-500 mb-6 font-bold">
                     {(isEditingUber || isEditingSalary) 
                       ? (language === 'ar' ? `لشهر ${selectedEntry?.month} ${selectedEntry?.year}` : `For ${selectedEntry?.month} ${selectedEntry?.year}`) 
                       : (language === 'ar' ? 'سيتم تحديث القيمة في الملف الشخصي' : 'Value will be updated in your profile')}
                   </p>
                   
                   <div className="space-y-6">
                      <div className="space-y-2">
                         <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">{language === 'ar' ? 'القيمة الجديدة (ج.م.)' : 'New Value (EGP)'}</label>
                         <input 
                           autoFocus
                           type="number"
                           value={tempValue}
                           onChange={(e) => setTempValue(e.target.value)}
                           className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xl font-bold focus:border-brand-yellow outline-none"
                         />
                      </div>
                      <div className="flex gap-3">
                         <button 
                           onClick={isEditingUber ? handleUpdateUber : isEditingSalary ? handleUpdateSalary : handleUpdateEmergency}
                           className="flex-1 bg-brand-yellow text-black py-4 rounded-2xl font-black hover:bg-yellow-400 transition-all active:scale-95"
                         >
                           {language === 'ar' ? 'حفظ التعديل' : 'Save Changes'}
                         </button>
                         <button 
                           onClick={() => { setIsEditingUber(false); setIsEditingEmergency(false); setIsEditingSalary(false); }}
                           className="px-6 py-4 rounded-2xl bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-all"
                         >
                           {language === 'ar' ? 'إلغاء' : 'Cancel'}
                         </button>
                      </div>
                   </div>
                </motion.div>
             </div>
          </div>
        )}
        
        {isAddingExpense && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsAddingExpense(false)}
               className="fixed inset-0 bg-black/80 backdrop-blur-sm"
             />
             <div className="min-h-full flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative glass max-w-md w-full p-8 rounded-[40px] shadow-2xl border border-brand-border"
                >
                <h3 className="text-xl font-black mb-1">{language === 'ar' ? 'إضافة مصروف جديد' : 'Add New Expense'}</h3>
                <p className="text-xs text-slate-500 mb-6 font-bold">{language === 'ar' ? `لشهر ${selectedEntry?.month} ${selectedEntry?.year}` : `For ${selectedEntry?.month} ${selectedEntry?.year}`}</p>
                
                <div className="space-y-6">
                   <div className="space-y-4">
                      <div className="space-y-2">
                         <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">{language === 'ar' ? 'فئة المصروف' : 'Expense Category'}</label>
                         <div className="grid grid-cols-4 gap-2">
                            {EXPENSE_CATEGORIES.map(cat => {
                               const CatIcon = cat.icon;
                               return (
                                  <button
                                     key={cat.id}
                                     type="button"
                                     onClick={() => setNewExpense({ ...newExpense, category: cat.id })}
                                     className={cn(
                                        "flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all",
                                        newExpense.category === cat.id 
                                           ? "bg-brand-yellow/10 border-brand-yellow text-brand-yellow scale-[1.02]" 
                                           : "bg-white/5 border-white/5 text-slate-500 hover:bg-white/10"
                                     )}
                                  >
                                     <CatIcon className="w-4 h-4" />
                                     <span className="text-[8px] font-black uppercase whitespace-nowrap">{language === 'ar' ? cat.label : cat.labelEn}</span>
                                  </button>
                               );
                            })}
                         </div>
                         
                         {newExpense.category === 'other' && (
                            <div className="pt-2">
                               <input 
                                 type="text"
                                 placeholder={language === 'ar' ? 'اسم الفئة الجديدة' : 'New Category Name'}
                                 value={newExpense.customCategory}
                                 onChange={(e) => setNewExpense({ ...newExpense, customCategory: e.target.value })}
                                 className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-[10px] font-bold focus:border-white outline-none"
                               />
                            </div>
                         )}
                      </div>

                      <div className="space-y-2">
                         <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">{language === 'ar' ? 'وصف المصروف' : 'Expense Description'}</label>
                         <input 
                           autoFocus
                           type="text"
                           placeholder={language === 'ar' ? 'مثال: إيجار الشقة' : 'e.g. Rent'}
                           value={newExpense.description}
                           onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                           className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-white outline-none"
                         />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">{language === 'ar' ? 'المبلغ (ج.م.)' : 'Amount (EGP)'}</label>
                      <input 
                        type="number"
                        placeholder="0"
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xl font-bold focus:border-brand-yellow outline-none"
                      />
                   </div>

                   <div className="flex items-center gap-4 p-4 bg-white/2 rounded-2xl border border-white/5">
                      <div className="flex-1">
                         <div className="text-[10px] font-black uppercase tracking-widest text-white">{language === 'ar' ? 'نظام أقساط؟' : 'Installment System?'}</div>
                         <div className="text-[8px] text-slate-500 font-bold">{language === 'ar' ? 'تكرار هذا المصروف لعدة أشهر' : 'Repeat this expense for multiple months'}</div>
                      </div>
                      <button 
                       onClick={() => setNewExpense({ ...newExpense, isInstallment: !newExpense.isInstallment })}
                       className={cn(
                         "w-12 h-6 rounded-full relative transition-all duration-300",
                         newExpense.isInstallment ? "bg-brand-yellow" : "bg-white/10"
                       )}
                      >
                         <div className={cn(
                           "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300",
                           newExpense.isInstallment ? "left-7 shadow-lg" : "left-1"
                         )} />
                      </button>
                   </div>

                   {newExpense.isInstallment && (
                     <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                       <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-2">
                           <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">{language === 'ar' ? 'بداية القسط' : 'Start Month'}</label>
                           <select 
                             value={newExpense.installmentStartId || selectedMonthId || ''}
                             onChange={(e) => setNewExpense({ ...newExpense, installmentStartId: e.target.value })}
                             className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-[10px] font-bold focus:border-white outline-none appearance-none"
                           >
                             {entries.map(entry => (
                               <option key={entry.id} value={entry.id}>{entry.month} {entry.year}</option>
                             ))}
                           </select>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">{language === 'ar' ? 'نهاية القسط' : 'End Month'}</label>
                            <select 
                              value={newExpense.installmentEndId}
                              onChange={(e) => setNewExpense({ ...newExpense, installmentEndId: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-[10px] font-bold focus:border-white outline-none appearance-none"
                            >
                              <option value="">{language === 'ar' ? 'اختر' : 'Select'}</option>
                              {entries.slice(entries.findIndex(e => e.id === (newExpense.installmentStartId || selectedMonthId)) + 1).map(entry => (
                                <option key={entry.id} value={entry.id}>{entry.month} {entry.year}</option>
                              ))}
                            </select>
                         </div>
                       </div>
                     </div>
                   )}
                   <div className="flex gap-3">
                      <button 
                        onClick={handleAddExpense}
                        className="flex-1 bg-brand-yellow text-black py-4 rounded-2xl font-black hover:bg-yellow-400 transition-all active:scale-95"
                      >
                        {language === 'ar' ? 'إضافة المصروف' : 'Add Expense'}
                      </button>
                      <button 
                        onClick={() => setIsAddingExpense(false)}
                        className="px-6 py-4 rounded-2xl bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-all"
                      >
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                   </div>
                </div>
             </motion.div>
          </div>
        </div>
        )}
      </AnimatePresence>

          <div className={cn(
            "fixed bottom-28 z-40 flex flex-col gap-4 transition-all duration-300", 
            language === 'ar' ? 'right-6' : 'right-6',
            isKeyboardVisible && "opacity-0 pointer-events-none scale-90"
          )}>
            <AnimatePresence>
              {showAiChat && (
                <motion.div 
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  className="bg-brand-bg/95 backdrop-blur-xl border border-brand-border w-[320px] sm:w-[400px] h-[500px] rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
                >
                  {/* Chat Header */}
                  <div className="bg-brand-card p-4 border-b border-brand-border flex items-center gap-3">
                    <div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center">
                      <Bot className="w-6 h-6 text-black" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black italic">{language === 'ar' ? 'مساعدك الذكي' : 'Smart Assistant'}</h4>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        <span className="text-[10px] text-slate-500 font-bold uppercase">{language === 'ar' ? 'متصل بالبيانات' : 'Data Connected'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Chat Content */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {chatResponse && (
                      <div className={cn("flex flex-col gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 text-xs italic")}>
                        <p className={cn("text-[10px] uppercase font-bold mb-1", isDark ? "text-white" : "text-slate-900")}>{language === 'ar' ? 'نصيحة AI' : 'AI Response'}:</p>
                        <div className="whitespace-pre-wrap">{chatResponse}</div>
                      </div>
                    )}
                {!chatResponse && !isChatLoading && (
                  <div className="text-center py-10">
                    <Sparkles className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-xs text-slate-500 px-6">
                      {language === 'ar' 
                        ? 'أهلاً بك! أنا مساعدك الذكي. اسألني أي شيء عن خطة ادخارك، دخل أوبر، أو حتى توقعات الذهب.'
                        : 'Hi! I am your AI assistant. Ask me anything about your savings plan, Uber income, or gold forecasts.'}
                    </p>
                  </div>
                )}
                {isChatLoading && (
                  <div className="flex justify-center p-4">
                    <div className="flex gap-1">
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce delay-100" />
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce delay-200" />
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce delay-300" />
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-brand-border bg-brand-card">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder={language === 'ar' ? 'اسأل مساعدك...' : 'Ask assistant...'}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold focus:border-white outline-none"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                  />
                  <button 
                    onClick={handleAskAI}
                    disabled={isChatLoading || !chatMessage.trim()}
                    className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-30"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={() => setShowAiChat(!showAiChat)}
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-2xl relative group",
            showAiChat ? "bg-white text-black rotate-90" : "bg-white text-black hover:scale-110 active:scale-90 shadow-xl border border-white/20"
          )}
        >
          {showAiChat ? <MessageSquare className="w-7 h-7" /> : <Bot className="w-8 h-8" />}
          {!showAiChat && (
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full border-2 border-black flex items-center justify-center shadow-lg"
              >
               <div className="w-1 h-1 bg-black rounded-full" />
            </motion.div>
          )}
        </button>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, isDark }: { 
  active: boolean, 
  onClick: () => void, 
  icon: React.ReactNode, 
  label: string,
  isDark: boolean
}) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-4 rounded-3xl transition-all duration-300",
        active 
          ? (isDark ? "bg-brand-yellow text-black shadow-lg shadow-brand-yellow/20" : "bg-brand-primary text-white shadow-lg shadow-brand-primary/20") 
          : (isDark ? "text-slate-400 hover:bg-white/5 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900")
      )}
    >
      {icon}
      <span className="font-black italic text-sm tracking-tight uppercase">{label}</span>
    </button>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  subValue, 
  highlight = false,
  editable = false,
  negative = false,
  isBlurred = false,
  isDark = true,
  onClick
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  subValue?: string;
  highlight?: boolean;
  editable?: boolean;
  negative?: boolean;
  isBlurred?: boolean;
  isDark?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.div 
      onClick={editable ? onClick : undefined}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={editable ? { scale: 1.02 } : {}}
      whileTap={editable ? { scale: 0.98 } : {}}
      className={cn(
        "rounded-3xl p-5 sm:p-6 relative group border transition-all h-full",
        isDark ? "glass card-outline opacity-80 hover:opacity-100 border-white/10" : "bg-white border-slate-200 shadow-sm opacity-100",
        highlight && (isDark ? "border-white/30" : "border-brand-yellow/50"),
        negative && (isDark ? "border-brand-red/20 bg-brand-red/5" : "bg-red-50 border-red-100"),
        editable && "cursor-pointer"
      )}
    >
      <div className={cn(
        "absolute top-4 left-4 flex gap-2 transition-all",
        isDark ? "opacity-40 group-hover:opacity-100" : "opacity-60"
      )}>
        {negative && <div className="w-1.5 h-1.5 bg-brand-red rounded-full shadow-[0_0_8px_rgba(255,0,0,0.5)] animate-pulse" />}
        {editable ? <Pencil className="w-3.5 h-3.5" /> : null}
      </div>
      <div className="mb-4">
        <div className={cn(
          "w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center",
          isDark ? "bg-white/3 border border-white/5" : "bg-slate-50 border border-slate-100"
        )}>
          {icon}
        </div>
      </div>
      <div className="space-y-0.5">
        <h4 className={cn(
          "text-[10px] font-bold uppercase tracking-widest",
          isDark ? "text-slate-500" : "text-slate-500"
        )}>{label}</h4>
        <div className={cn(
          "text-base sm:text-lg font-black transition-all duration-500 break-words",
          isDark ? "text-white" : "text-slate-900",
          isBlurred && (isDark ? "blur-md select-none opacity-40" : "blur-sm select-none opacity-60")
        )}>{value}</div>
        {subValue && <div className={cn(
          "text-[8px] leading-tight mt-2 transition-all duration-500 font-bold",
          isDark ? "text-slate-500" : "text-slate-500",
          isBlurred && "blur-[2px] opacity-20"
        )}>{subValue}</div>}
      </div>
    </motion.div>
  );
}
