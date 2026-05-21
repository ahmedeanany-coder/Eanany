import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  FileJson, 
  CheckCircle2, 
  AlertTriangle, 
  Coins, 
  Receipt, 
  Database, 
  Info, 
  ArrowRight, 
  Play, 
  ChevronRight, 
  Sparkles,
  Terminal,
  HelpCircle,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { MonthlyEntry, UserProfile, ExpenseItem, GoldTransaction } from '../types';
import { doc, updateDoc, writeBatch, collection } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface FileConverterProps {
  user: any;
  db: any;
  profile: UserProfile | null;
  entries: MonthlyEntry[];
  language: 'ar' | 'en';
  isDark: boolean;
  onRefreshData?: () => void;
  setCurrentProject: (proj: 'savings' | 'daily' | 'expenses' | 'settings' | 'gold' | 'stats' | 'ai') => void;
}

type ConversionType = 'expenses' | 'gold' | 'backup';

export default function FileConverter({
  user,
  db,
  profile,
  entries,
  language,
  isDark,
  onRefreshData,
  setCurrentProject
}: FileConverterProps) {
  // --- States ---
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [conversionType, setConversionType] = useState<ConversionType>('expenses');
  const [targetMonthId, setTargetMonthId] = useState<string>('');
  
  // Parsed File Content Cache
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]); // spreadsheet rows or parsed JSON object
  const [showMapping, setShowMapping] = useState(false);

  // Column Mapping values
  const [columnMap, setColumnMap] = useState<Record<string, string>>({
    amount: '',
    description: '',
    category: '',
    date: '',
    weight: '',
    pricePerUnit: '',
    notes: ''
  });

  // Flow control states
  const [status, setStatus] = useState<'idle' | 'converting' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStepText, setCurrentStepText] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [errorDetails, setErrorDetails] = useState('');
  const [isVibrating, setIsVibrating] = useState(false);

  // Stats result
  const [summary, setSummary] = useState({
    successCount: 0,
    skippedCount: 0,
    totalValue: 0
  });

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autofill target month with current or first available month
  useState(() => {
    const currentMonthStr = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const hasCurrentMonth = entries.some(e => e.id === currentMonthStr);
    if (hasCurrentMonth) {
      setTargetMonthId(currentMonthStr);
    } else if (entries.length > 0) {
      setTargetMonthId(entries[0].id);
    }
  });

  // Haptic feedback
  const triggerVibration = (ms: number) => {
    if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  };

  // --- Drag and Drop Handlers ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // --- Helper to Autodetect Mappings ---
  const autoDetectMapKeys = (fileHeaders: string[], type: ConversionType) => {
    const defaultMap = {
      amount: '',
      description: '',
      category: '',
      date: '',
      weight: '',
      pricePerUnit: '',
      notes: ''
    };

    if (type === 'expenses') {
      // Look for amount/debit/val/سحب/مبلغ/قيمة
      const amtMatch = fileHeaders.find(h => /amount|debit|val|price|مبلغ|قيمة|سحب|المدفوع|المنصرف/i.test(h));
      // Look for description/details/stat/بيان/وصف
      const descMatch = fileHeaders.find(h => /desc|detail|stat|memo|title|بيان|وصف|العملية|المعاملة/i.test(h));
      // Look for category/تصنيف
      const catMatch = fileHeaders.find(h => /category|type|tag|تصنيف|فئة/i.test(h));
      // Look for date/تاريخ
      const dateMatch = fileHeaders.find(h => /date|time|تاريخ|يوم/i.test(h));

      defaultMap.amount = amtMatch || '';
      defaultMap.description = descMatch || '';
      defaultMap.category = catMatch || '';
      defaultMap.date = dateMatch || '';
    } else if (type === 'gold') {
      // Look for weight/وزن/جرام/غرام
      const wtMatch = fileHeaders.find(h => /weight|gram|qty|unit|وزن|جرام|عيار/i.test(h));
      // Look for price/rate/سعر
      const priceMatch = fileHeaders.find(h => /price|rate|cost|سعر|قيمة/i.test(h));
      // Look for date/تاريخ
      const dateMatch = fileHeaders.find(h => /date|time|تاريخ|يوم/i.test(h));
      // Look for notes/ملاحظات
      const notesMatch = fileHeaders.find(h => /note|memo|detail|بيان|ملاحظات/i.test(h));

      defaultMap.weight = wtMatch || '';
      defaultMap.pricePerUnit = priceMatch || '';
      defaultMap.date = dateMatch || '';
      defaultMap.notes = notesMatch || '';
    }

    setColumnMap(defaultMap);
  };

  // --- Processing Uploaded File ---
  const processFile = (file: File) => {
    setSelectedFile(file);
    setShowMapping(false);
    setRawRows([]);
    setHeaders([]);

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          setRawRows(parsed);
          setConversionType('backup');
          setShowMapping(true);
        } catch (err: any) {
          setErrorDetails(language === 'ar' ? 'ملف JSON غير صالح أو معطوب.' : 'Invalid or corrupted JSON file.');
          setStatus('error');
        }
      };
      reader.readAsText(file);
    } else {
      // Excel/CSV
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          // Use defval to ensure empty columns are represented
          const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { defval: "" });

          if (jsonData.length === 0) {
            setErrorDetails(language === 'ar' ? 'الملف خالٍ من البيانات.' : 'The file is empty.');
            setStatus('error');
            return;
          }

          setRawRows(jsonData);
          
          // Get unique headers matching columns from spreadsheet keys
          const allKeys = Array.from(
            new Set(jsonData.flatMap(row => Object.keys(row)))
          );
          setHeaders(allKeys);
          
          // Preselect mappings automatically
          autoDetectMapKeys(allKeys, conversionType);
          setShowMapping(true);
        } catch (err: any) {
          console.error(err);
          setErrorDetails(language === 'ar' ? 'فشل قراءة ملف إكسل أو CSV.' : 'Failed to read Excel or CSV file.');
          setStatus('error');
        }
      };
      reader.readAsArrayBuffer(file);
    }
    triggerVibration(15);
  };

  // Switch type and reset auto detection
  const handleTypeChange = (type: ConversionType) => {
    setConversionType(type);
    if (headers.length > 0) {
      autoDetectMapKeys(headers, type);
    }
  };

  // Standard auto category matcher based on descriptions (embedded to remain offline)
  const getAutoCategoryLocal = (desc: string): string => {
    const text = desc.toLowerCase();
    if (text.includes('rent') || text.includes('منزل') || text.includes('ايجار') || text.includes('إيجار') || text.includes('كهرباء') || text.includes('غاز') || text.includes('مياه')) return 'home';
    if (text.includes('uber') || text.includes('كريم') || text.includes('اجرة') || text.includes('مواصلات') || text.includes('بنزين') || text.includes('transport') || text.includes('سفر')) return 'transport';
    if (text.includes('market') || text.includes('hyper') || text.includes('طلبات') || text.includes('طعام') || text.includes('أكل') || text.includes('سوبرماركت') || text.includes('بقالة') || text.includes('مطعم') || text.includes('food') || text.includes('rest')) return 'food';
    if (text.includes('hospital') || text.includes('علاج') || text.includes('صيدلية') || text.includes('دكتور') || text.includes('طبيب') || text.includes('صحة') || text.includes('health')) return 'health';
    if (text.includes('sub') || text.includes('bill') || text.includes('فاتورة') || text.includes('نت') || text.includes('انترنت') || text.includes('شحن') || text.includes('موبايل') || text.includes('utilities')) return 'utilities';
    if (text.includes('buy') || text.includes('ملابس') || text.includes('تسوق') || text.includes('amazon') || text.includes('نون') || text.includes('shopping')) return 'shopping';
    if (text.includes('cafe') || text.includes('سينما') || text.includes('ترفيه') || text.includes('cinema') || text.includes('play') || text.includes('ent')) return 'entertainment';
    return 'other';
  };

  // --- Real-Time Conversion Thread ---
  const startConversion = async () => {
    if (!user) return;
    setStatus('converting');
    setProgress(0);
    setTerminalLogs([]);
    setErrorDetails('');

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    try {
      // 1. Loading Step (0% - 15%)
      setProgress(10);
      setCurrentStepText(language === 'ar' ? 'جاري فتح وقراءة الملف واستخراج السطور...' : 'Reading file structures & locating tables...');
      setTerminalLogs(prev => [...prev, `[INIT] Process started: ${selectedFile?.name}`, `[INIT] Conversion target: ${conversionType.toUpperCase()}`]);
      await delay(600);

      // Validate inputs
      if (conversionType === 'expenses') {
        if (!targetMonthId) {
          throw new Error(language === 'ar' ? 'يرجى تحديد الشهر المستهدف قبل البدء.' : 'Please select a target month.');
        }
        if (!columnMap.amount || !columnMap.description) {
          throw new Error(language === 'ar' ? 'يرجى تحديد أعمده القيمة والوصف الإجبارية.' : 'Please map the mandatory Amount and Description columns.');
        }
      } else if (conversionType === 'gold') {
        if (!columnMap.weight || !columnMap.pricePerUnit) {
          throw new Error(language === 'ar' ? 'يرجى تحديد أعمده الوزن وسعر الجرام الإجبارية.' : 'Please map the mandatory Weight and Price indicators.');
        }
      }

      // 2. Formatting & Parsing Step (15% - 40%)
      setProgress(30);
      setCurrentStepText(language === 'ar' ? 'تحليل بنية المصفوفات والتأكد من سلامة البيانات...' : 'Analyzing rows, validating formats...');
      setTerminalLogs(prev => [...prev, `[PARSE] Raw records found: ${rawRows.length}`, `[PARSE] Sanitizing column values...`]);
      await delay(700);

      const itemsToImport: any[] = [];
      let successLocal = 0;
      let skippedLocal = 0;
      let totalAmountParsed = 0;

      if (conversionType === 'expenses') {
        // Find existing selected month
        const targetMonth = entries.find(e => e.id === targetMonthId);
        if (!targetMonth) {
          throw new Error(language === 'ar' ? `إن الشهر المحدد (${targetMonthId}) غير موجود في سجلاتك.` : `The target month (${targetMonthId}) is not initialized.`);
        }

        rawRows.forEach((row, idx) => {
          const rawAmount = row[columnMap.amount];
          const rawDesc = row[columnMap.description];
          
          if (rawAmount === undefined || rawAmount === null || rawAmount === "" || !rawDesc) {
            skippedLocal++;
            setTerminalLogs(prev => [...prev, `[WARNING] Row ${idx + 1}: Skipped (Empty Amount or Description)`]);
            return;
          }

          // Parse numeric amount
          const cleanAmount = parseFloat(String(rawAmount).replace(/[^\d.-]/g, ''));
          if (isNaN(cleanAmount) || cleanAmount <= 0) {
            skippedLocal++;
            setTerminalLogs(prev => [...prev, `[WARNING] Row ${idx + 1}: Invalid positive numeric amount [${rawAmount}] (Skipped)`]);
            return;
          }

          // Resolve Category
          let category = 'other';
          if (columnMap.category && row[columnMap.category]) {
            const mappedCat = String(row[columnMap.category]).trim().toLowerCase();
            // Match with supported categories
            const supported = ['home', 'food', 'transport', 'utilities', 'health', 'shopping', 'entertainment', 'other'];
            if (supported.includes(mappedCat)) {
              category = mappedCat;
            } else {
              category = getAutoCategoryLocal(rawDesc);
            }
          } else {
            category = getAutoCategoryLocal(rawDesc);
          }

          // Resolve Date
          let dateStr = new Date().toISOString().split('T')[0];
          if (columnMap.date && row[columnMap.date]) {
            try {
              const parsedDate = new Date(row[columnMap.date]);
              if (!isNaN(parsedDate.getTime())) {
                dateStr = parsedDate.toISOString().split('T')[0];
              }
            } catch (dErr) {}
          }

          const parsedItem: ExpenseItem = {
            id: `imported_${Date.now()}_${idx}_${Math.floor(Math.random() * 1000)}`,
            description: String(rawDesc).trim(),
            amount: cleanAmount,
            category,
            date: dateStr
          };

          itemsToImport.push(parsedItem);
          totalAmountParsed += cleanAmount;
          successLocal++;
          if (successLocal <= 8) {
            setTerminalLogs(prev => [...prev, `[SUCCESS] Resolved: "${parsedItem.description}" - ${cleanAmount.toLocaleString()} EGP (${category.toUpperCase()})`]);
          }
        });

      } else if (conversionType === 'gold') {
        
        rawRows.forEach((row, idx) => {
          const rawWeight = row[columnMap.weight];
          const rawPriceUnit = row[columnMap.pricePerUnit];
          const rawNotes = columnMap.notes ? row[columnMap.notes] : '';

          if (rawWeight === undefined || rawWeight === null || rawWeight === "" || rawPriceUnit === undefined || rawPriceUnit === null || rawPriceUnit === "") {
            skippedLocal++;
            setTerminalLogs(prev => [...prev, `[WARNING] Row ${idx + 1}: Skipped (Missing weight or price per gram)`]);
            return;
          }

          const cleanWeight = parseFloat(String(rawWeight).replace(/[^\d.-]/g, ''));
          const cleanPriceUnit = parseFloat(String(rawPriceUnit).replace(/[^\d.-]/g, ''));

          if (isNaN(cleanWeight) || cleanWeight <= 0 || isNaN(cleanPriceUnit) || cleanPriceUnit <= 0) {
            skippedLocal++;
            setTerminalLogs(prev => [...prev, `[WARNING] Row ${idx + 1}: Invalid positive weight or price [${rawWeight}, ${rawPriceUnit}] (Skipped)`]);
            return;
          }

          // Resolve Date
          let dateStr = new Date().toISOString().split('T')[0];
          if (columnMap.date && row[columnMap.date]) {
            try {
              const parsedDate = new Date(row[columnMap.date]);
              if (!isNaN(parsedDate.getTime())) {
                dateStr = parsedDate.toISOString().split('T')[0];
              }
            } catch (dErr) {}
          }

          const calculatedCost = cleanWeight * cleanPriceUnit;

          const parsedGold: GoldTransaction = {
            id: `imported_gold_${Date.now()}_${idx}`,
            date: dateStr,
            weight: cleanWeight,
            pricePerUnit: cleanPriceUnit,
            price: calculatedCost,
            notes: rawNotes ? String(rawNotes).trim() : (language === 'ar' ? 'استيراد جماعي' : 'Batch Imported')
          };

          itemsToImport.push(parsedGold);
          totalAmountParsed += calculatedCost;
          successLocal++;
          if (successLocal <= 8) {
            setTerminalLogs(prev => [...prev, `[SUCCESS] Resolved gold log: ${cleanWeight}g @ ${cleanPriceUnit} EGP/g (= ${calculatedCost.toLocaleString()} EGP)`]);
          }
        });

      } else if (conversionType === 'backup') {
        // Validate keys in backup JSON structure
        const bk = rawRows as any;
        if (!bk.profile && !bk.allEntries) {
          throw new Error(language === 'ar' ? 'ملف احتياطي غير صالح، يجب أن يحتوي على بيانات الملف الشخصي والمدخلات.' : 'Invalid backup format. Recheck JSON backup headers.');
        }
        successLocal = bk.allEntries ? bk.allEntries.length : 1;
        setTerminalLogs(prev => [...prev, `[VALIDATE] Validated backup format. Detected username: ${bk.profile?.userName || 'Anonymous'}`]);
      }

      setTerminalLogs(prev => [...prev, `[INFO] Parsed successfully: ${successLocal} records. Skipped: ${skippedLocal}`]);

      // 3. Mapping and intelligence additions (40% - 70%)
      setProgress(60);
      setCurrentStepText(language === 'ar' ? 'تصنيف العمليات وتطبيق تصنيف فلوستي الذكي...' : 'Auto-classifying categories, applying formatting...');
      await delay(700);
      
      if (itemsToImport.length === 0 && conversionType !== 'backup') {
        throw new Error(language === 'ar' ? 'لم يعثر التطبيق على أي صفوف صالحة ومطابقة للاستيراد!' : 'No eligible records found after validation checks.');
      }

      // 4. Writing into Firestore (70% - 92%)
      setProgress(80);
      setCurrentStepText(language === 'ar' ? 'كتابة المعاملات الجديدة وتحديث قاعدة بيانات السحابة...' : 'Writing changes to secure Cloud Firestore...');
      setTerminalLogs(prev => [...prev, `[FIRESTORE] Synchronizing cloud documents...`]);
      await delay(600);

      if (conversionType === 'expenses') {
        const targetMonth = entries.find(e => e.id === targetMonthId)!;
        const entryRef = doc(db, 'profiles', user.uid, 'entries', targetMonthId);
        
        // Append all imported expenses to existing ones
        const finalExpensesList = [...(targetMonth.expenses || []), ...itemsToImport];
        await updateDoc(entryRef, {
          expenses: finalExpensesList
        });

        setTerminalLogs(prev => [...prev, `[COMPLETED] Updated document entries/${targetMonthId} with ${itemsToImport.length} expenses.`]);

      } else if (conversionType === 'gold') {
        const batch = writeBatch(db);
        
        itemsToImport.forEach(item => {
          const goldDocRef = doc(collection(db, 'profiles', user.uid, 'goldLogs'));
          batch.set(goldDocRef, item);
        });

        await batch.commit();
        setTerminalLogs(prev => [...prev, `[COMPLETED] Committed batch Gold Log writes (${itemsToImport.length} documents) successfully.`]);

      } else if (conversionType === 'backup') {
        const bk = rawRows as any;
        const batch = writeBatch(db);

        // 1. Profile Restoration
        if (bk.profile) {
          const profileRef = doc(db, 'profiles', user.uid);
          batch.set(profileRef, bk.profile);
          setTerminalLogs(prev => [...prev, `[FIRESTORE] Batched profile restoration details.`]);
        }

        // 2. Entries Restoration
        if (bk.allEntries && Array.isArray(bk.allEntries)) {
          bk.allEntries.forEach((entry: any) => {
            const entryRef = doc(db, 'profiles', user.uid, 'entries', entry.id);
            batch.set(entryRef, entry);
          });
          setTerminalLogs(prev => [...prev, `[FIRESTORE] Batched ${bk.allEntries.length} months data.`]);
        }

        await batch.commit();
        setTerminalLogs(prev => [...prev, `[COMPLETED] Fully restored database elements.`]);
      }

      // 5. Done! (100%)
      setProgress(100);
      setSummary({
        successCount: successLocal,
        skippedCount: skippedLocal,
        totalValue: totalAmountParsed
      });

      triggerVibration(40);
      setStatus('success');
      
      // Refresh parent dataset context
      if (onRefreshData) {
        onRefreshData();
      }

    } catch (err: any) {
      console.error(err);
      triggerVibration(20);
      setTerminalLogs(prev => [...prev, `[ERROR] Failed: ${err.message || err}`]);
      setErrorDetails(err.message || String(err));
      setStatus('error');
    }
  };

  const handleResetConverter = () => {
    setSelectedFile(null);
    setRawRows([]);
    setHeaders([]);
    setShowMapping(false);
    setStatus('idle');
    setProgress(0);
    setTerminalLogs([]);
  };

  // --- Views ---
  return (
    <div className="max-w-4xl mx-auto px-4 space-y-8 mb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Title block */}
      <div className={cn("rounded-[40px] p-8 border transition-all duration-500", isDark ? "glass border-white/10" : "bg-white border-slate-200 shadow-sm")}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-6">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-16 h-16 rounded-[24px] flex items-center justify-center border shadow-inner transition-all duration-500",
              isDark ? "bg-white/5 text-amber-400 border-white/10" : "bg-amber-100 text-amber-700 border-amber-200"
            )}>
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div>
              <h2 className={cn("text-3xl font-black italic uppercase tracking-tighter", isDark ? "text-white" : "text-slate-900")}>
                {language === 'ar' ? 'محوّل البيانات ومستورد الملفات' : 'Smart File Converter'}
              </h2>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">
                {language === 'ar' ? 'تحويل كشوف الحسابات والإكسل إلى ذمة مالية سحابية آمنة' : 'Import offline spreadsheets, bank exports, or JSON backup states'}
              </p>
            </div>
          </div>

          {status !== 'idle' && (
            <button
              onClick={handleResetConverter}
              className={cn(
                "px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider border flex items-center gap-2",
                isDark ? "bg-white/5 hover:bg-white/10 text-white border-white/10" : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              )}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {language === 'ar' ? 'إعادة ضبط' : 'Reset Upload'}
            </button>
          )}
        </div>

        {/* Informational Guidance Box */}
        {status === 'idle' && (
          <div className={cn(
            "p-5 rounded-3xl border flex items-start gap-4 mb-8 text-xs leading-relaxed",
            isDark ? "bg-white/3 border-white/5 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-600"
          )}>
            <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold text-amber-400 block mb-1">
                {language === 'ar' ? 'كيف يعمل محول ذمة فلوستي؟' : 'How does the Flossy converter operate?'}
              </span>
              {language === 'ar' ? (
                <span>
                  يمكّنك هذا المحول من رفع ملفات كشف الحساب البنكي بصيغة Excel أو CSV ثم ترصيف الأعمدة (مثلاً تحديد عمود المبلغ والوصف) ليتم قراءتها واستيرادها آلياً وتصنيفها بالذكاء الاصطناعي الخاص بنا مباشرة كمعاملات داخل ذمتك المالية المحددة.
                </span>
              ) : (
                <span>
                  Drop any raw bank spreadsheet or gold records (.xlsx, .csv, and JSON backup bundles). Choose columns directly inside the map builder, analyze performance with real-time indicators, and write with complete protection to your database ledger.
                </span>
              )}
            </div>
          </div>
        )}

        {/* MAIN CONTROLLER VIEW SWITCH */}
        <AnimatePresence mode="wait">
          
          {/* STATE INITIAL: UPLOAD PLACEHOLDER */}
          {status === 'idle' && !showMapping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Dropzone Container */}
              <div 
                className={cn(
                  "border-2 border-dashed rounded-[35px] py-16 px-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all relative overflow-hidden group",
                  dragActive 
                    ? (isDark ? "border-amber-400 bg-amber-400/5 scale-[1.01]" : "border-amber-500 bg-amber-50 scale-[1.01]")
                    : (isDark ? "border-white/15 bg-white/2 hover:border-white/30 hover:bg-white/4" : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50")
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {/* Background ambient lighting effects */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-amber-400/3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".csv,.xlsx,.xls,.json"
                  className="hidden" 
                />

                <div className={cn(
                  "w-16 h-16 rounded-[22px] flex items-center justify-center border mb-6 transition-transform group-hover:scale-110",
                  isDark ? "bg-white/5 text-slate-400 border-white/10" : "bg-white text-slate-500 border-slate-200 shadow-sm"
                )}>
                  <Upload className="w-7 h-7 animate-pulse text-amber-400" />
                </div>

                <div className="space-y-2">
                  <h3 className={cn("text-lg font-black italic uppercase leading-none", isDark ? "text-white" : "text-slate-900")}>
                    {language === 'ar' ? 'قم بسحب وإفلات الملف هنا لتهيئة القراءة' : 'Drag & Drop your transaction file'}
                  </h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                    {language === 'ar' ? 'يدعم Excel (.xlsx, .xls), CSV أو ملفات النسخ الاحتياطي JSON' : 'Supports Excel Sheets, CSV formats, and Backups'}
                  </p>
                </div>

                <div className="mt-8">
                  <span className={cn(
                    "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-colors shadow-sm",
                    isDark ? "bg-white/5 border-white/5 text-white hover:bg-white/10" : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"
                  )}>
                    {language === 'ar' ? 'أو تصفح الملفات يدوياً' : 'Browse Local files'}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* STATE INITIAL 2: COLUMN MAPPING PANEL */}
          {status === 'idle' && showMapping && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* File Detail header card */}
              <div className={cn(
                "p-5 rounded-[30px] border flex items-center justify-between",
                isDark ? "bg-white/3 border-white/5" : "bg-slate-50 border-slate-200"
              )}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-400/20 rounded-2xl text-amber-400">
                    {conversionType === 'backup' ? <FileJson className="w-6 h-6" /> : <FileSpreadsheet className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className={cn("text-sm font-black italic", isDark ? "text-white" : "text-slate-900")}>{selectedFile?.name}</h4>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">
                      {(selectedFile?.size || 0) > 1024 * 1024 
                        ? `${((selectedFile?.size || 0) / (1024 * 1024)).toFixed(2)} MB` 
                        : `${((selectedFile?.size || 0) / 1024).toFixed(1)} KB`
                      } • {conversionType === 'backup' ? 'JSON' : `${rawRows.length} Row rows`}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleResetConverter}
                  className="p-2 hover:bg-brand-red/10 hover:text-brand-red text-slate-500 rounded-xl transition-colors"
                  title={language === 'ar' ? 'إزالة الملف' : 'Clear File'}
                >
                  <AlertTriangle className="w-5 h-5 text-brand-red" />
                </button>
              </div>

              {/* Settings Configuration Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Panel 1: Select conversion type */}
                <div className="space-y-4">
                  <span className={cn("text-[10px] font-black uppercase tracking-widest block", isDark ? "text-slate-500" : "text-slate-400")}>
                    {language === 'ar' ? '1. حدد نوع وطبيعة التحويل' : '1. SELECT CONVERSION PATH'}
                  </span>
                  
                  <div className="flex flex-col gap-3">
                    {selectedFile?.name.endsWith('.json') ? (
                      <button
                        className={cn(
                          "p-4 rounded-[24px] border flex items-center gap-4 text-left transition-all",
                          "bg-amber-400/10 border-amber-400 text-amber-400 font-black italic"
                        )}
                      >
                        <Database className="w-6 h-6" />
                        <div>
                          <div className="text-sm font-black mb-0.5">{language === 'ar' ? 'استعادة قاعدة البيانات بالكامل' : 'Database Full Restore'}</div>
                          <div className="text-[10px] opacity-70 font-semibold uppercase">{language === 'ar' ? 'استيراد نسخة احتياطية من ملف JSON' : 'Processes full json configuration state'}</div>
                        </div>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleTypeChange('expenses')}
                          className={cn(
                            "p-5 rounded-[28px] border flex items-center justify-between text-left transition-all",
                            conversionType === 'expenses'
                              ? "bg-amber-400/10 border-amber-400 text-amber-400 transform scale-[1.01] shadow-md shadow-amber-400/5 hover:bg-amber-400/15"
                              : (isDark ? "bg-white/2 border-white/5 hover:bg-white/5 text-slate-400" : "bg-slate-50/50 border-slate-100 hover:bg-slate-50 text-slate-700")
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <Receipt className="w-6 h-6 shrink-0 text-amber-400" />
                            <div>
                              <div className="text-sm font-black leading-none">{language === 'ar' ? 'مصروفات الشهر' : 'Month Expense items'}</div>
                              <span className="text-[9px] opacity-60 font-medium tracking-wider uppercase">{language === 'ar' ? 'تحويل كشف الحساب البنكي إلى مصروفات ومفرقعات' : 'Renders rows to monthly costs list'}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-50" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTypeChange('gold')}
                          className={cn(
                            "p-5 rounded-[28px] border flex items-center justify-between text-left transition-all",
                            conversionType === 'gold'
                              ? "bg-amber-400/10 border-amber-400 text-amber-400 transform scale-[1.01] shadow-md shadow-amber-400/5 hover:bg-amber-400/15"
                              : (isDark ? "bg-white/2 border-white/5 hover:bg-white/5 text-slate-400" : "bg-slate-50/50 border-slate-100 hover:bg-slate-50 text-slate-700")
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <Coins className="w-6 h-6 shrink-0 text-amber-400" />
                            <div>
                              <div className="text-sm font-black leading-none">{language === 'ar' ? 'عمليات شراء الذهب' : 'Gold Investment Transactions'}</div>
                              <span className="text-[9px] opacity-60 font-medium tracking-wider uppercase">{language === 'ar' ? 'تحويل الفاتورة أو ملف المعاملات لمدخرات ذهبية' : 'Renders tables to gold records'}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-50" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Panel 2: Additional mappings depending on type */}
                <div className="space-y-4">
                  {conversionType === 'expenses' && (
                    <div className="space-y-2">
                      <span className={cn("text-[10px] font-black uppercase tracking-widest block", isDark ? "text-slate-500" : "text-slate-400")}>
                        {language === 'ar' ? '2. حدد الشهر المستهدف' : '2. SELECT LEDGER MONTH'}
                      </span>
                      <select
                        value={targetMonthId}
                        onChange={(e) => setTargetMonthId(e.target.value)}
                        className={cn(
                          "w-full px-5 py-4 rounded-2xl border text-sm font-black outline-none transition-all",
                          isDark 
                            ? "bg-slate-900 border-white/10 text-white focus:border-amber-400" 
                            : "bg-white border-slate-200 text-slate-900 focus:border-amber-500 shadow-sm"
                        )}
                      >
                        <option value="">{language === 'ar' ? '--- الرجاء الاختيار ---' : '--- Choose Month ---'}</option>
                        {entries.map(entry => (
                          <option key={entry.id} value={entry.id}>
                            {entry.month} {entry.year} (Expenses count: {entry.expenses?.length || 0})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {conversionType === 'backup' ? (
                    <div className={cn(
                      "p-5 rounded-[28px] border h-full flex flex-col justify-center gap-2",
                      isDark ? "bg-amber-400/5 border-amber-400/10 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-800"
                    )}>
                      <Database className="w-6 h-6" />
                      <span className="text-xs font-extrabold">{language === 'ar' ? 'جاهز للاستيراد الكامل' : 'Authorized Restore Bundle'}</span>
                      <p className="text-[10px] opacity-80 leading-relaxed font-semibold">
                        {language === 'ar' 
                          ? 'سيقوم هذا الإجراء بإعادة ضبط قاعدة البيانات وسيد بجميع بيانات الملف التعريفي والعمليات السابقة بالكامل من هذا الملف.' 
                          : 'This step overwrites all cloud profiles & transaction records back to parameters encapsulated within this backup archive.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <span className={cn("text-[10px] font-black uppercase tracking-widest block", isDark ? "text-slate-500" : "text-slate-400")}>
                        {language === 'ar' ? '2. تطابق أعمدة الملف' : '2. CONVERT-COLUMN MAPPING'}
                      </span>
                      
                      {/* Column Maps Dropdowns */}
                      <div className="space-y-3">
                        {conversionType === 'expenses' ? (
                          <>
                            {/* Amount field */}
                            <div className="flex items-center justify-between gap-4">
                              <label className="text-[11px] font-extrabold text-slate-400 shrink-0">
                                {language === 'ar' ? 'المبلغ المطلوب *' : 'Amount *'}
                              </label>
                              <select
                                value={columnMap.amount}
                                onChange={(e) => setColumnMap({ ...columnMap, amount: e.target.value })}
                                className={cn(
                                  "px-3 py-1.5 rounded-xl border text-xs outline-none focus:border-amber-400 max-w-[200px] truncate",
                                  isDark ? "bg-slate-900 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
                                )}
                              >
                                <option value="">-- Choose column --</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </div>

                            {/* Description Field */}
                            <div className="flex items-center justify-between gap-4">
                              <label className="text-[11px] font-extrabold text-slate-400 shrink-0">
                                {language === 'ar' ? 'البيان/الوصف *' : 'Description *'}
                              </label>
                              <select
                                value={columnMap.description}
                                onChange={(e) => setColumnMap({ ...columnMap, description: e.target.value })}
                                className={cn(
                                  "px-3 py-1.5 rounded-xl border text-xs outline-none focus:border-amber-400 max-w-[200px] truncate",
                                  isDark ? "bg-slate-900 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
                                )}
                              >
                                <option value="">-- Choose column --</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </div>

                            {/* Category Field */}
                            <div className="flex items-center justify-between gap-4">
                              <label className="text-[11px] font-extrabold text-slate-450 shrink-0">
                                {language === 'ar' ? 'التصنيف (اختياري)' : 'Category (Optional)'}
                              </label>
                              <select
                                value={columnMap.category}
                                onChange={(e) => setColumnMap({ ...columnMap, category: e.target.value })}
                                className={cn(
                                  "px-3 py-1.5 rounded-xl border text-xs outline-none focus:border-amber-400 max-w-[200px] truncate",
                                  isDark ? "bg-slate-900 border-white/10 text-slate-400 hover:text-white" : "bg-white border-slate-200 text-slate-500"
                                )}
                              >
                                <option value="">-- Auto-categorize row --</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </div>

                            {/* Date Field */}
                            <div className="flex items-center justify-between gap-4">
                              <label className="text-[11px] font-extrabold text-slate-450 shrink-0">
                                {language === 'ar' ? 'التاريخ (اختياري)' : 'Date (Optional)'}
                              </label>
                              <select
                                value={columnMap.date}
                                onChange={(e) => setColumnMap({ ...columnMap, date: e.target.value })}
                                className={cn(
                                  "px-3 py-1.5 rounded-xl border text-xs outline-none focus:border-amber-400 max-w-[200px] truncate",
                                  isDark ? "bg-slate-900 border-white/10 text-slate-400 hover:text-white" : "bg-white border-slate-200 text-slate-500"
                                )}
                              >
                                <option value="">-- Default to Today --</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Gold - Weight field */}
                            <div className="flex items-center justify-between gap-4">
                              <label className="text-[11px] font-extrabold text-slate-400 shrink-0">
                                {language === 'ar' ? 'الوزن بالجرام *' : 'Weight (g) *'}
                              </label>
                              <select
                                value={columnMap.weight}
                                onChange={(e) => setColumnMap({ ...columnMap, weight: e.target.value })}
                                className={cn(
                                  "px-3 py-1.5 rounded-xl border text-xs outline-none focus:border-amber-400 max-w-[200px] truncate",
                                  isDark ? "bg-slate-900 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
                                )}
                              >
                                <option value="">-- Choose column --</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </div>

                            {/* Gold - Price Unit Unit */}
                            <div className="flex items-center justify-between gap-4">
                              <label className="text-[11px] font-extrabold text-slate-400 shrink-0">
                                {language === 'ar' ? 'سعر الجرام *' : 'Price / Gram *'}
                              </label>
                              <select
                                value={columnMap.pricePerUnit}
                                onChange={(e) => setColumnMap({ ...columnMap, pricePerUnit: e.target.value })}
                                className={cn(
                                  "px-3 py-1.5 rounded-xl border text-xs outline-none focus:border-amber-400 max-w-[200px] truncate",
                                  isDark ? "bg-slate-900 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
                                )}
                              >
                                <option value="">-- Choose column --</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </div>

                            {/* Gold - Date Field */}
                            <div className="flex items-center justify-between gap-4">
                              <label className="text-[11px] font-extrabold text-slate-450 shrink-0">
                                {language === 'ar' ? 'التاريخ (اختياري)' : 'Date (Optional)'}
                              </label>
                              <select
                                value={columnMap.date}
                                onChange={(e) => setColumnMap({ ...columnMap, date: e.target.value })}
                                className={cn(
                                  "px-3 py-1.5 rounded-xl border text-xs outline-none focus:border-amber-400 max-w-[200px] truncate",
                                  isDark ? "bg-slate-900 border-white/10 text-slate-400 hover:text-white" : "bg-white border-slate-200 text-slate-500"
                                )}
                              >
                                <option value="">-- Default to Today --</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </div>

                            {/* Gold - Notes Field */}
                            <div className="flex items-center justify-between gap-4">
                              <label className="text-[11px] font-extrabold text-slate-450 shrink-0">
                                {language === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (Optional)'}
                              </label>
                              <select
                                value={columnMap.notes}
                                onChange={(e) => setColumnMap({ ...columnMap, notes: e.target.value })}
                                className={cn(
                                  "px-3 py-1.5 rounded-xl border text-xs outline-none focus:border-amber-400 max-w-[200px] truncate",
                                  isDark ? "bg-slate-900 border-white/10 text-slate-400 hover:text-white" : "bg-white border-slate-200 text-slate-500"
                                )}
                              >
                                <option value="">-- None --</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* Execution Action Button */}
              <div className="h-px bg-white/5 my-6" />

              <div className="flex justify-end gap-4">
                <button
                  onClick={handleResetConverter}
                  className={cn(
                    "px-7 py-4 rounded-2xl text-xs font-black uppercase tracking-wider border",
                    isDark ? "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={startConversion}
                  className="px-8 py-4 bg-brand-yellow text-black rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-brand-yellow/15"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {conversionType === 'backup' 
                    ? (language === 'ar' ? 'البدء في استعادة البيانات' : 'Trigger Full Restore') 
                    : (language === 'ar' ? 'البدء في تحويل البيانات' : 'Start Conversion Now')}
                </button>
              </div>

            </motion.div>
          )}

          {/* STATE 3: CONVERTING / ANIMATING RADAR INDICATION */}
          {status === 'converting' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              {/* Spinning / progress track circle & percentages */}
              <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
                
                {/* Visual Radar Loader */}
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-amber-400/20 rounded-full" />
                  <motion.div 
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, ease: "linear", duration: 1.5 }}
                    className="absolute inset-0 border-4 border-t-amber-400 border-r-transparent border-b-transparent border-l-transparent rounded-full"
                  />
                  <div className="text-2xl font-black italic text-white font-mono">{progress}%</div>
                </div>

                <div className="space-y-2">
                  <h3 className={cn("text-lg font-black italic uppercase text-amber-400")}>
                    {language === 'ar' ? 'جاري التحويل والاستيراد ذكياً...' : 'CONVERTING DATABASE LEDGER...'}
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-extrabold text-slate-500 uppercase tracking-widest max-w-md mx-auto line-clamp-1">
                    <Sparkles className="w-4 h-4 text-brand-yellow shrink-0 animate-bounce" />
                    <span>{currentStepText}</span>
                  </div>
                </div>
              </div>

              {/* Progress bar line */}
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  className="bg-brand-yellow h-full"
                  style={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut", duration: 0.3 }}
                />
              </div>

              {/* Real-Time Terminal Log Console */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Live output logger console</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                    <span className="text-[8px] font-mono text-emerald-500 tracking-wider font-extrabold uppercase">STREAMING_ONLINE</span>
                  </div>
                </div>

                <div className="bg-slate-950 text-slate-400 p-6 rounded-3xl border border-white/5 font-mono text-[10px] leading-relaxed max-h-[180px] overflow-y-auto space-y-1.5 select-text custom-scrollbar text-left scroll-smooth" dir="ltr">
                  {terminalLogs.map((log, idx) => {
                    let textClass = "text-slate-400";
                    if (log.includes('[SUCCESS]')) textClass = "text-emerald-400";
                    if (log.includes('[WARNING]')) textClass = "text-amber-500";
                    if (log.includes('[ERROR]')) textClass = "text-brand-red font-bold";
                    if (log.includes('[INIT]') || log.includes('[COMPLETED]')) textClass = "text-sky-400 font-bold";

                    return (
                      <div key={idx} className={textClass}>
                        {log}
                      </div>
                    );
                  })}
                </div>
              </div>

            </motion.div>
          )}

          {/* STATE 4: SUCCESS COMPLETED SCREEN */}
          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="text-center space-y-8 p-6"
            >
              
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 animate-bounce" />
                </div>
                <div>
                  <h3 className={cn("text-2xl font-black italic uppercase leading-none text-emerald-400")}>
                    {language === 'ar' ? 'اكتملت عملية التحويل والاستيراد بنجاح!' : 'CONVERSION COMPLETED PERFECTLY!'}
                  </h3>
                  <p className="text-xs text-slate-500 font-extrabold uppercase tracking-widest leading-none mt-2">
                    {language === 'ar' ? 'تمت كتابة وتأصيل السجلات وتأمينها سحابياً.' : 'Records successfully indexed to cloud ledger'}
                  </p>
                </div>
              </div>

              {/* Conversion Statistics Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
                
                {/* Block 1: Success records */}
                <div className={cn(
                  "p-5 rounded-2xl border text-center font-sans",
                  isDark ? "bg-white/3 border-white/5" : "bg-slate-50 border-slate-200 shadow-inner"
                )}>
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase block mb-1">
                    {language === 'ar' ? 'عمليات مستوردة' : 'Imported Rows'}
                  </span>
                  <div className="text-2xl font-black text-emerald-400">{summary.successCount}</div>
                </div>

                {/* Block 2: Skipped records */}
                <div className={cn(
                  "p-5 rounded-2xl border text-center font-sans",
                  isDark ? "bg-white/3 border-white/5" : "bg-slate-50 border-slate-200 shadow-inner"
                )}>
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase block mb-1">
                    {language === 'ar' ? 'عمليات تم تجاهلها' : 'Skipped Rows'}
                  </span>
                  <div className="text-2xl font-black text-amber-500">{summary.skippedCount}</div>
                </div>

                {/* Block 3: Translated valuation */}
                <div className={cn(
                  "p-5 rounded-2xl border text-center font-sans col-span-2 sm:col-span-1",
                  isDark ? "bg-white/3 border-white/5" : "bg-slate-50 border-slate-200 shadow-inner"
                )}>
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase block mb-1">
                    {language === 'ar' ? 'القيمة الإجمالية' : 'Total Value'}
                  </span>
                  <div className="text-sm font-black text-amber-500 truncate mt-1">
                    {conversionType === 'backup' ? 'N/A' : `${summary.totalValue.toLocaleString()} EGP`}
                  </div>
                </div>

              </div>

              {/* Action buttons list */}
              <div className="h-px bg-white/5 my-6" />

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={handleResetConverter}
                  className={cn(
                    "w-full sm:w-auto px-7 py-4 rounded-2xl text-xs font-black uppercase tracking-wider border",
                    isDark ? "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  {language === 'ar' ? 'تحويل ملف آخر' : 'Convert Another File'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetPage = conversionType === 'expenses' ? 'expenses' : (conversionType === 'gold' ? 'gold' : 'savings');
                    setCurrentProject(targetPage);
                    handleResetConverter();
                  }}
                  className="w-full sm:w-auto px-8 py-4 bg-brand-yellow text-black rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-brand-yellow/15"
                >
                  <span>{language === 'ar' ? 'الذهاب لعرض التقرير' : 'Go View Records'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </motion.div>
          )}

          {/* STATE 5: ERROR PAGE */}
          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="text-center space-y-6 p-6"
            >
              
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-20 h-20 bg-brand-red/10 border border-brand-red/30 text-brand-red rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-10 h-10 animate-pulse" />
                </div>
                <div>
                  <h3 className={cn("text-2xl font-black italic uppercase leading-none text-brand-red")}>
                    {language === 'ar' ? 'فشلت عملية التحويل أو المزامنة!' : 'CONVERSION FAILED!'}
                  </h3>
                  <p className="text-xs text-slate-500 font-extrabold uppercase tracking-widest leading-none mt-2">
                    {language === 'ar' ? 'يرجى مراجعة تفاصيل الخطأ في الأسفل وتجربة الرفع مرة أخرى.' : 'Review details below & check troubleshooting options'}
                  </p>
                </div>
              </div>

              {/* Error Detail Display */}
              <div className="bg-brand-red/5 text-brand-red px-6 py-5 rounded-[24px] border border-brand-red/15 text-xs text-left max-w-xl mx-auto font-sans leading-relaxed">
                <span className="font-extrabold block mb-1 uppercase tracking-wider">{language === 'ar' ? 'المشكلة الكامنة:' : 'ROOT EXCEPTION:'}</span>
                {errorDetails}
              </div>

              {/* Terminal Logs in failure */}
              {terminalLogs.length > 0 && (
                <div className="max-w-xl mx-auto space-y-2">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest text-left block">System Crash Dumps:</span>
                  <div className="bg-slate-950 text-slate-400 p-5 rounded-2xl border border-white/5 font-mono text-[9px] text-left max-h-[120px] overflow-y-auto space-y-1 select-text custom-scrollbar">
                    {terminalLogs.slice(-6).map((log, idx) => (
                      <div key={idx} className={log.includes('[ERROR]') ? 'text-brand-red' : 'text-slate-500'}>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Troubleshooting Tips */}
              <div className={cn(
                "p-5 rounded-[28px] border text-left text-xs max-w-xl mx-auto space-y-1",
                isDark ? "bg-white/2 border-white/5 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-600"
              )}>
                <span className="font-black text-amber-450 block mb-1">{language === 'ar' ? 'نصائح استكشاف الأخطاء وإصلاحها:' : 'Troubleshooting indicators:'}</span>
                <ul className="list-disc pl-5 space-y-1">
                  <li>{language === 'ar' ? 'تأكد من اختيار وتطابق جميع أعمدة القيمة والوصف الضرورية.' : 'Confirm structural maps correlate matching header keys.'}</li>
                  <li>{language === 'ar' ? 'تحقق من خلو الخلايا المالية من النصوص أو الرموز الغريبة غير الرقمية.' : 'Clean cell numbers of alphabetical values.'}</li>
                  <li>{language === 'ar' ? 'تأكد من أنك متصل بشبكة الإنترنت لإرسال التحديثات السحابية.' : 'Verify internet connection is alive for Firebase sync.'}</li>
                </ul>
              </div>

              <div className="h-px bg-white/5 my-6" />

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleResetConverter}
                  className="px-8 py-4 bg-brand-yellow text-black rounded-2xl text-xs font-black uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-brand-yellow/15"
                >
                  {language === 'ar' ? 'المحاولة مجدداً' : 'Retry Upload File'}
                </button>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
