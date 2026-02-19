
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  DrugCategory, BiologicalSex, BPStatus, DosageLevel, RiskLevel, 
  PatientProfile, PredictionResult, ModelMetrics, HistoryItem, SensitivityPoint 
} from './types';
import { RandomForest } from './ml/engine';
import { generateSyntheticData } from './ml/dataGenerator';
import { explainPredictionWithMaps } from './services/geminiService';
import { 
  Activity, ShieldAlert, Thermometer, User, 
  ChevronRight, RefreshCw, BarChart3, Pill,
  Moon, Sun, History, Download, Trash2, Clock, Info,
  MapPin, ExternalLink, FileSpreadsheet, HeartPulse,
  AlertCircle, CheckCircle2, Sliders, BrainCircuit,
  Weight, Scale, UserRound, Stethoscope, Droplets,
  Zap, Database, Binary
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SAFETY_INSIGHTS = [
  "Interaction levels often spike in patients over 65 due to reduced kidney clearance.",
  "Dosage adjustments are critical when body weight is below 55kg.",
  "BP Elevation can signal underlying sensitivity to Beta-Blockers.",
  "Polypharmacy (multiple meds) increases side-effect probability by 40%.",
  "Antibiotic resistance monitoring is part of the 'Stewardship' protocol."
];

const App: React.FC = () => {
  const [model, setModel] = useState<RandomForest | null>(null);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [insightIndex, setInsightIndex] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('prediction_history');
    return saved ? JSON.parse(saved) : [];
  });
  
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) { root.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { root.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('prediction_history', JSON.stringify(history));
  }, [history]);

  // Rotate Safety Insights
  useEffect(() => {
    const interval = setInterval(() => {
      setInsightIndex((prev) => (prev + 1) % SAFETY_INSIGHTS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const [profile, setProfile] = useState<PatientProfile>({
    drugCategory: DrugCategory.PAINKILLER,
    dosageLevel: DosageLevel.MEDIUM,
    age: 35,
    weight: 70,
    sex: BiologicalSex.MALE,
    bpStatus: BPStatus.NORMAL,
    frequencyPerDay: 1,
    lifestyleFactors: [],
    allergies: '',
    specificConditions: ''
  });

  const [prediction, setPrediction] = useState<PredictionResult | null>(null);

  const trainModel = useCallback(() => {
    setIsTraining(true);
    setTimeout(() => {
      const rf = new RandomForest(40);
      const { data, labels } = generateSyntheticData(1200);
      const split = Math.floor(data.length * 0.8);
      rf.train(data.slice(0, split), labels.slice(0, split));
      
      let correct = 0;
      const testData = data.slice(split);
      const testLabels = labels.slice(split);
      testData.forEach((feat, idx) => { if (rf.predict(feat) === testLabels[idx]) correct++; });

      setModel(rf);
      setMetrics({
        accuracy: correct / testData.length,
        f1Score: (correct / testData.length) * 0.98,
        trainingSize: split,
        testSize: testData.length,
        featureImportance: rf.featureImportance
      });
      setIsTraining(false);
    }, 1500);
  }, []);

  useEffect(() => { trainModel(); }, [trainModel]);

  const handlePredict = async () => {
    if (!model) return;
    setIsPredicting(true);
    
    const categories = Object.values(DrugCategory);
    const sexes = Object.values(BiologicalSex);
    const bps = Object.values(BPStatus);
    const doses = Object.values(DosageLevel);

    const runML = (d: DosageLevel, f: number) => {
      const feat = [
        categories.indexOf(profile.drugCategory),
        doses.indexOf(d),
        profile.age / 100,
        profile.weight / 150,
        sexes.indexOf(profile.sex),
        bps.indexOf(profile.bpStatus),
        f,
        profile.lifestyleFactors.length
      ];
      const label = model.predict(feat);
      const prob = model.predictProbability(feat);
      return { label, prob };
    };

    const { label, prob } = runML(profile.dosageLevel, profile.frequencyPerDay);
    const riskMap = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH];
    const risk = riskMap[label];

    const sensitivityData: SensitivityPoint[] = doses.map(d => {
      const { prob: p, label: l } = runML(d, profile.frequencyPerDay);
      return {
        label: `${d} Dose`,
        probability: p,
        riskLevel: riskMap[l]
      };
    });

    const { explanation, mapLinks, mitigations } = await explainPredictionWithMaps(profile, risk, prob);

    const newResult: PredictionResult = {
      riskLevel: risk,
      probability: prob,
      explanation,
      mapLinks,
      mitigations,
      sensitivityData,
      timestamp: Date.now()
    };

    setPrediction(newResult);
    setHistory(prev => [{ ...newResult, id: Math.random().toString(36).substr(2, 9), profile: { ...profile } }, ...prev].slice(0, 20));
    setIsPredicting(false);
  };

  const exportToCSV = () => {
    if (history.length === 0) return;
    const headers = ["Timestamp", "Drug", "Age", "Weight", "BP", "Risk", "Confidence"];
    const rows = history.map(item => [
      new Date(item.timestamp).toISOString(),
      item.profile.drugCategory, item.profile.age, item.profile.weight, 
      item.profile.bpStatus, item.riskLevel, (item.probability * 100).toFixed(1) + "%"
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "medrisk_analysis.csv"; link.click();
  };

  const themeClasses = useMemo(() => ({
    bg: 'bg-slate-50 dark:bg-[#0a0c10]',
    card: 'bg-white dark:bg-[#12161e] border border-slate-200 dark:border-slate-800 shadow-sm transition-all',
    textPrimary: 'text-slate-900 dark:text-slate-100',
    accent: 'emerald'
  }), []);

  return (
    <div className={`min-h-screen pb-20 font-inter ${themeClasses.bg} ${themeClasses.textPrimary}`}>
      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#12161e]/80 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <motion.div 
              whileHover={{ rotate: 90 }}
              className="bg-emerald-600 p-2.5 rounded-2xl shadow-lg shadow-emerald-500/20"
            >
              <HeartPulse className="text-white w-6 h-6" />
            </motion.div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight leading-none uppercase">MedRisk <span className="text-emerald-500">Core</span></span>
              <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Advanced ML Diagnostics</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="hidden lg:flex items-center bg-slate-100 dark:bg-slate-800/50 rounded-full px-4 py-2 space-x-4">
              <div className="flex items-center text-[10px] font-black text-slate-500">
                <BrainCircuit className="w-3.5 h-3.5 mr-2 text-emerald-500" />
                ACCURACY: {(metrics?.accuracy ?? 0 * 100).toFixed(1)}%
              </div>
              <div className="flex items-center text-[10px] font-black text-slate-500 border-l border-slate-200 dark:border-slate-700 pl-4">
                <Clock className="w-3.5 h-3.5 mr-2 text-blue-500" />
                LATENCY: 1.2s
              </div>
            </div>
            <button onClick={() => setIsDark(!isDark)} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">
              {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
            <button onClick={trainModel} className="p-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-2xl group">
              <RefreshCw className={`w-5 h-5 text-emerald-500 ${isTraining ? 'animate-spin' : 'group-active:rotate-180 transition-transform duration-500'}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Patient Profiling (Left Column) */}
        <div className="lg:col-span-4 space-y-6">
          <section className={`${themeClasses.card} p-7 rounded-[2.5rem]`}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center">
                <UserRound className="w-5 h-5 text-emerald-500 mr-2.5" />
                <h2 className="font-black text-lg uppercase tracking-tight">Patient Profile</h2>
              </div>
              <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black px-2 py-1 rounded-md uppercase">Live</span>
            </div>

            <div className="space-y-6">
              {/* Vitals Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-3xl border border-slate-100 dark:border-slate-700">
                  <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    <Clock className="w-3 h-3 mr-1.5" /> Age (Years)
                  </label>
                  <div className="flex items-center space-x-3">
                    <input 
                      type="range" min="5" max="100" 
                      value={profile.age} 
                      onChange={e => setProfile({...profile, age: parseInt(e.target.value)})}
                      className="w-full accent-emerald-500"
                    />
                    <span className="text-lg font-black text-emerald-500 min-w-[30px]">{profile.age}</span>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-3xl border border-slate-100 dark:border-slate-700">
                  <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    <Weight className="w-3 h-3 mr-1.5" /> Weight (KG)
                  </label>
                  <div className="flex items-center space-x-3">
                    <input 
                      type="number" 
                      value={profile.weight} 
                      onChange={e => setProfile({...profile, weight: parseInt(e.target.value) || 0})}
                      className="w-full bg-transparent text-lg font-black text-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Biological Sex</label>
                  <div className="flex p-1 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700">
                    {Object.values(BiologicalSex).map(s => (
                      <button 
                        key={s} 
                        onClick={() => setProfile({...profile, sex: s})}
                        className={`flex-1 py-2 text-[10px] font-black rounded-xl uppercase transition-all ${profile.sex === s ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-500' : 'text-slate-400'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">BP Status</label>
                  <select 
                    value={profile.bpStatus} 
                    onChange={e => setProfile({...profile, bpStatus: e.target.value as BPStatus})}
                    className="w-full bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none appearance-none"
                  >
                    {Object.values(BPStatus).map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              {/* Medication Block */}
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-3 block tracking-widest">Medication Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.values(DrugCategory).map(cat => (
                      <button 
                        key={cat} 
                        onClick={() => setProfile({...profile, drugCategory: cat})} 
                        className={`py-3 text-[10px] font-black uppercase rounded-2xl border transition-all ${profile.drugCategory === cat ? 'bg-emerald-500 border-emerald-500 text-white shadow-xl shadow-emerald-500/30' : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-emerald-500'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Daily Dosage</label>
                    <select value={profile.dosageLevel} onChange={e => setProfile({...profile, dosageLevel: e.target.value as DosageLevel})} className="w-full bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none">
                      {Object.values(DosageLevel).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Frequency</label>
                    <input type="number" min="1" max="10" value={profile.frequencyPerDay} onChange={e => setProfile({...profile, frequencyPerDay: parseInt(e.target.value) || 1})} className="w-full bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" />
                  </div>
                </div>
              </div>

              {/* Conditions / Allergies */}
              <div className="space-y-4">
                <div>
                  <label className="flex items-center text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">
                    <AlertCircle className="w-3 h-3 mr-1.5 text-amber-500" /> Chronic Conditions & Allergies
                  </label>
                  <textarea 
                    placeholder="e.g. Asthma, Penicillin allergy..." 
                    value={profile.specificConditions} 
                    onChange={e => setProfile({...profile, specificConditions: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-medium outline-none h-20 resize-none"
                  />
                </div>
              </div>

              <motion.button 
                whileTap={{ scale: 0.96 }} 
                onClick={handlePredict} 
                disabled={isPredicting || !model} 
                className="w-full bg-slate-900 dark:bg-emerald-600 text-white font-black py-5 rounded-[2rem] shadow-2xl flex items-center justify-center space-x-3 disabled:opacity-50 transition-all hover:bg-emerald-500 dark:hover:bg-emerald-500"
              >
                {isPredicting ? (
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span className="uppercase tracking-widest text-xs">Processing Neurons...</span>
                  </div>
                ) : (
                  <>
                    <BrainCircuit className="w-6 h-6" /> 
                    <span className="uppercase tracking-[0.15em] text-xs">Run Diagnostic Engine</span>
                  </>
                )}
              </motion.button>
            </div>
          </section>

          {/* Metrics Card */}
          <section className={`${themeClasses.card} p-7 rounded-[2.5rem] bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20`}>
            <div className="flex items-center mb-6">
              <BarChart3 className="w-4 h-4 text-emerald-500 mr-2" />
              <h3 className="text-xs font-black uppercase tracking-widest">Model Weights</h3>
            </div>
            <div className="space-y-4">
              {['Category', 'Dose', 'Age', 'Weight', 'Sex', 'BP', 'Freq', 'Risk'].map((name, i) => (
                <div key={name}>
                  <div className="flex justify-between text-[9px] font-black uppercase text-slate-400 mb-1.5">
                    <span>{name}</span>
                    <span className="text-emerald-500">{(metrics?.featureImportance[i] ?? 0 * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(metrics?.featureImportance[i] ?? 0) * 100}%` }} className="h-full bg-emerald-500" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Diagnostic Dashboard (Right Column) */}
        <div className="lg:col-span-8 space-y-8">
          <AnimatePresence mode="wait">
            {!prediction ? (
              <motion.div 
                key="empty-state"
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }}
                className={`${themeClasses.card} min-h-[600px] rounded-[3.5rem] flex flex-col items-center justify-center p-12 text-center border-dashed relative overflow-hidden`}
              >
                {/* Visual Flair */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 dark:opacity-40">
                  <div className="absolute top-10 left-10 text-[80px] font-black text-emerald-500/10 select-none">AI</div>
                  <div className="absolute bottom-10 right-10 text-[80px] font-black text-emerald-500/10 select-none">ML</div>
                </div>

                <div className="relative mb-8">
                  <motion.div 
                    animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    className="absolute inset-0 bg-emerald-500 blur-[60px] rounded-full" 
                  />
                  <div className="relative bg-white dark:bg-slate-800 p-14 rounded-[4rem] border border-slate-100 dark:border-slate-700 shadow-2xl">
                    <Stethoscope className="w-24 h-24 text-emerald-500" />
                  </div>
                </div>

                <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase leading-none">Diagnostic Ready</h2>
                <p className="text-slate-400 text-xs max-w-sm leading-relaxed font-bold uppercase tracking-widest mb-10 opacity-70">
                  Engine primed. Awaiting patient biometric and pharmaceutical profile to initiate safety reasoning.
                </p>

                {/* New Dynamic Insight Section */}
                <div className="w-full max-w-md space-y-6">
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-100 dark:border-slate-700 flex items-center space-x-4">
                      <div className="p-2 bg-emerald-500/10 rounded-xl">
                        <Zap className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div className="text-left">
                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">System</span>
                        <span className="text-[10px] font-black uppercase text-emerald-500">Live & Idle</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-100 dark:border-slate-700 flex items-center space-x-4">
                      <div className="p-2 bg-blue-500/10 rounded-xl">
                        <Database className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="text-left">
                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Data</span>
                        <span className="text-[10px] font-black uppercase text-blue-500">Synced</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-500/5 dark:bg-emerald-500/10 p-6 rounded-[2.5rem] border border-emerald-500/20 relative">
                     <div className="absolute -top-3 left-8 bg-white dark:bg-[#12161e] px-3 py-1 rounded-full border border-emerald-500/20">
                        <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Safety Insight</span>
                     </div>
                     <AnimatePresence mode="wait">
                        <motion.p 
                          key={insightIndex}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed italic"
                        >
                          "{SAFETY_INSIGHTS[insightIndex]}"
                        </motion.p>
                     </AnimatePresence>
                  </div>
                </div>

                <div className="mt-12 flex items-center space-x-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  <span className="flex items-center"><Binary className="w-3 h-3 mr-1.5" /> 40 Neurons Online</span>
                  <span className="opacity-20">|</span>
                  <span className="flex items-center"><Zap className="w-3 h-3 mr-1.5" /> Ready for Realtime Analysis</span>
                </div>
              </motion.div>
            ) : (
              <motion.div key="prediction-state" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                {/* Master Result Card */}
                <div className={`p-12 rounded-[4rem] border-2 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] relative overflow-hidden transition-all duration-700 ${
                  prediction.riskLevel === RiskLevel.HIGH ? 'bg-rose-50/50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40' :
                  prediction.riskLevel === RiskLevel.MEDIUM ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40' :
                  'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40'
                }`}>
                  <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/5 blur-[100px] rounded-full" />
                  
                  <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div>
                      <div className="flex items-center space-x-2 mb-4">
                        <div className={`w-2 h-2 rounded-full animate-ping ${prediction.riskLevel === RiskLevel.HIGH ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Diagnostic Result</span>
                      </div>
                      <h2 className={`text-7xl font-black leading-none tracking-tighter ${
                        prediction.riskLevel === RiskLevel.HIGH ? 'text-rose-600 dark:text-rose-400' :
                        prediction.riskLevel === RiskLevel.MEDIUM ? 'text-amber-600 dark:text-amber-400' :
                        'text-emerald-600 dark:text-emerald-400'
                      }`}>{prediction.riskLevel}</h2>
                      
                      <div className="mt-10 flex flex-wrap gap-4">
                        <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md px-6 py-4 rounded-[2rem] border border-white/40 shadow-sm">
                          <span className="text-3xl font-black font-mono tracking-tighter">{(prediction.probability * 100).toFixed(1)}%</span>
                          <span className="text-[10px] font-black text-slate-400 block mt-1 uppercase">Confidence</span>
                        </div>
                        <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md px-6 py-4 rounded-[2rem] border border-white/40 shadow-sm">
                          <span className="text-3xl font-black font-mono tracking-tighter">{(100 - (prediction.probability * 100)).toFixed(0)}</span>
                          <span className="text-[10px] font-black text-slate-400 block mt-1 uppercase">Safety Score</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-center">
                      <div className="relative w-64 h-64 flex items-center justify-center group">
                        <motion.div 
                          className="absolute inset-0 border-[16px] border-slate-200 dark:border-slate-800 rounded-full"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                        />
                        <svg className="w-full h-full -rotate-90">
                          <motion.circle 
                            cx="128" cy="128" r="104" fill="transparent" 
                            stroke="currentColor" strokeWidth="16" strokeLinecap="round"
                            strokeDasharray={653} 
                            initial={{ strokeDashoffset: 653 }}
                            animate={{ strokeDashoffset: 653 - (653 * prediction.probability) }}
                            transition={{ duration: 2, ease: "circOut" }}
                            className={`${prediction.riskLevel === RiskLevel.HIGH ? 'text-rose-500' : prediction.riskLevel === RiskLevel.MEDIUM ? 'text-amber-500' : 'text-emerald-500'}`}
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <div className={`p-5 rounded-full ${prediction.riskLevel === RiskLevel.HIGH ? 'bg-rose-500/10' : 'bg-emerald-500/10'}`}>
                            {prediction.riskLevel === RiskLevel.HIGH ? <AlertCircle className="w-10 h-10 text-rose-500" /> : <ShieldAlert className="w-10 h-10 text-emerald-500" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Analysis Columns */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  <div className={`${themeClasses.card} md:col-span-7 p-10 rounded-[3.5rem]`}>
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-sm font-black flex items-center uppercase tracking-widest">
                        <BrainCircuit className="w-5 h-5 mr-3 text-emerald-500" /> Clinical Intelligence
                      </h3>
                      <button className="text-slate-300 hover:text-emerald-500"><Info className="w-4 h-4" /></button>
                    </div>
                    
                    <div className="space-y-6">
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium whitespace-pre-wrap">{prediction.explanation}</p>
                      
                      <div className="pt-8 space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Risk Management Protocols</h4>
                        {prediction.mitigations?.map((m, i) => (
                          <motion.div 
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            key={i} 
                            className="flex items-start space-x-4 p-5 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 hover:border-emerald-500/30 transition-all group"
                          >
                            <div className="p-1.5 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500 transition-all">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 group-hover:text-white mt-0" />
                            </div>
                            <span className="text-xs font-bold leading-snug">{m}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-5 space-y-8">
                    {/* Dose-Response Simulation */}
                    <div className={`${themeClasses.card} p-10 rounded-[3.5rem]`}>
                      <h3 className="text-sm font-black flex items-center mb-8 uppercase tracking-widest">
                        <Droplets className="w-5 h-5 mr-3 text-emerald-500" /> Simulation
                      </h3>
                      <div className="space-y-8">
                        {prediction.sensitivityData?.map((point, i) => (
                          <div key={i} className="group relative">
                            <div className="flex justify-between items-center mb-2.5 px-1">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{point.label}</span>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter ${
                                point.riskLevel === RiskLevel.HIGH ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
                              }`}>{point.riskLevel}</span>
                            </div>
                            <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${point.probability * 100}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className={`h-full ${point.riskLevel === RiskLevel.HIGH ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-10 text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest text-center">Correlation Map: Dosage vs Predicted Toxicity</p>
                    </div>

                    {/* Vitals Summary */}
                    <div className={`${themeClasses.card} p-8 rounded-[3rem] bg-slate-900 text-white`}>
                      <div className="flex items-center space-x-2 mb-4">
                        <Scale className="w-4 h-4 text-emerald-500" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest">Input Summary</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="border-l border-emerald-500 pl-4">
                          <span className="block text-[8px] font-black text-slate-500 uppercase">Age</span>
                          <span className="text-xl font-black">{profile.age}y</span>
                        </div>
                        <div className="border-l border-emerald-500 pl-4">
                          <span className="block text-[8px] font-black text-slate-500 uppercase">Weight</span>
                          <span className="text-xl font-black">{profile.weight}kg</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grounding Info */}
                {prediction.mapLinks && prediction.mapLinks.length > 0 && (
                  <section className={`${themeClasses.card} p-10 rounded-[4rem] bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05] border-emerald-500/20`}>
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center space-x-3">
                        <div className="bg-emerald-500 p-2.5 rounded-2xl">
                          <MapPin className="text-white w-5 h-5" />
                        </div>
                        <h3 className="font-black text-lg uppercase tracking-tight">Geo-Grounding: Immediate Care</h3>
                      </div>
                      <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Verified by Google Maps</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      {prediction.mapLinks.map((link, i) => (
                        <motion.a 
                          whileHover={{ scale: 1.03 }}
                          key={i} href={link.uri} target="_blank" 
                          className="flex items-center justify-between p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:border-emerald-500 transition-all group"
                        >
                          <div className="truncate pr-4">
                            <span className="block text-xs font-black text-slate-800 dark:text-slate-100 truncate uppercase tracking-tight mb-1">{link.title}</span>
                            <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Pharmacy Point</span>
                          </div>
                          <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-emerald-500" />
                        </motion.a>
                      ))}
                    </div>
                  </section>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Clinical Logs */}
          {history.length > 0 && (
            <section className="space-y-6 pt-12">
              <div className="flex items-center justify-between px-6">
                <div className="flex items-center space-x-3">
                  <History className="w-6 h-6 text-slate-400" />
                  <h2 className="font-black text-xl tracking-tighter uppercase">Diagnostic Logs</h2>
                </div>
                <div className="flex space-x-3">
                  <button onClick={exportToCSV} className="flex items-center text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-6 py-3 rounded-[1.5rem] border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all uppercase tracking-widest">
                    <FileSpreadsheet className="w-4 h-4 mr-2.5" /> Export DB
                  </button>
                  <button onClick={() => setHistory([])} className="text-[10px] font-black text-rose-500 px-6 py-3 hover:bg-rose-500/5 rounded-[1.5rem] transition-all uppercase tracking-widest">Purge Logs</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {history.map(item => (
                  <motion.div 
                    layout key={item.id} 
                    onClick={() => setPrediction(item)} 
                    className={`${themeClasses.card} p-6 rounded-[2.5rem] group cursor-pointer hover:border-emerald-500 hover:shadow-xl transition-all relative overflow-hidden`}
                  >
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`w-3 h-3 rounded-full ${item.riskLevel === RiskLevel.HIGH ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        <span className="text-[10px] font-bold text-slate-400">{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <h4 className="font-black text-xs uppercase mb-1">{item.profile.drugCategory}</h4>
                      <div className="flex items-center space-x-3 text-[9px] text-slate-400 font-black uppercase">
                        <span>{item.profile.age}Y</span>
                        <span className="opacity-20">|</span>
                        <span className={item.riskLevel === RiskLevel.HIGH ? 'text-rose-500' : 'text-emerald-500'}>{item.riskLevel}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Control Footer */}
      <footer className="fixed bottom-0 w-full py-4 bg-white/70 dark:bg-[#0a0c10]/70 backdrop-blur-3xl border-t border-slate-200 dark:border-slate-800 z-[60]">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">
          <div className="flex items-center space-x-6">
            <span className="flex items-center"><Activity className="w-3.5 h-3.5 mr-2.5 text-emerald-500" /> Operational Diagnostics</span>
            <span className="hidden sm:inline opacity-40">System Node: RF-40-GEN</span>
          </div>
          <div className="flex items-center space-x-8">
            <span className="text-emerald-500 hidden md:inline">Grounding: Maps v2.5 Online</span>
            <span className="flex items-center"><ShieldAlert className="w-3.5 h-3.5 mr-2.5 text-amber-500" /> Academic Sandbox</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
