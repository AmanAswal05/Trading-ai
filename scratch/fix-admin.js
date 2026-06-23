const fs = require('fs');

function fixAccuracy() {
    let content = fs.readFileSync('components/admin/AccuracyTab.tsx', 'utf8');
    content = content.replace("{currentTab === 'accuracy' && (", "");
    content = content.replace(/ \)$/, ""); // remove trailing parenthesis
    // add regimeStats to props
    content = content.replace("indicatorPerformance,", "indicatorPerformance, regimeStats,");
    fs.writeFileSync('components/admin/AccuracyTab.tsx', content);
}

function fixAuditor() {
    let content = fs.readFileSync('components/admin/AuditorTab.tsx', 'utf8');
    content = content.replace("{currentTab === 'auditor' && (", "");
    content = content.replace(/ \)$/, ""); 
    
    // add missing imports
    content = content.replace("import { Search, Save, RotateCcw, Play, CheckCircle2, XCircle } from 'lucide-react';", "import { Search, Save, RotateCcw, Play, CheckCircle2, XCircle, Activity, RefreshCw, AlertCircle, Sliders, ShieldCheck, Info } from 'lucide-react';");
    content = content.replace("import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';", "import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';");
    
    // missing props
    content = content.replace("auditTicker, manualTicker", "auditTicker, setAuditTicker, manualTicker");
    content = content.replace("resetToDefault, saveTuningConfig", "resetToDefault, saveTuningConfig, isTunedActive, formatConvertedPrice, formatPrice");
    
    fs.writeFileSync('components/admin/AuditorTab.tsx', content);
}

function fixMetrics() {
    let content = fs.readFileSync('components/admin/MetricsTab.tsx', 'utf8');
    content = content.replace("{currentTab === 'metrics' && (", "");
    content = content.replace(/ \)$/, "");
    
    // add missing imports
    content = content.replace("import { Users, CreditCard, Percent, BarChart3, Database } from 'lucide-react';", "import { Users, CreditCard, Percent, BarChart3, Database, Activity, ArrowUpRight, Search } from 'lucide-react';");
    
    // missing props
    content = content.replace("revenueTrendData, convertedRevenueTrendData, convert, symbol, formatConvertedPrice, decimalPlaces", "revenueTrendData, convertedRevenueTrendData, convert, symbol, formatConvertedPrice, decimalPlaces, formatPrice, convertToUsd");
    
    // any types
    content = content.replace("pay =>", "(pay: any) =>");
    content = content.replace("sub =>", "(sub: any) =>");
    
    fs.writeFileSync('components/admin/MetricsTab.tsx', content);
}

function fixBacktestModal() {
    let content = fs.readFileSync('components/admin/BacktestModal.tsx', 'utf8');
    // add missing props
    content = content.replace("cancelBacktestJob }", "cancelBacktestJob, setActiveJobId, setJobProgress }");
    fs.writeFileSync('components/admin/BacktestModal.tsx', content);
}

function fixPage() {
    let content = fs.readFileSync('app/admin/page.tsx', 'utf8');
    content = content.replace("<AccuracyTab ", "<AccuracyTab regimeStats={regimeStats} ");
    content = content.replace("<AuditorTab ", "<AuditorTab setAuditTicker={setAuditTicker} formatConvertedPrice={formatConvertedPrice} formatPrice={formatPrice} isTunedActive={isTunedActive} ");
    content = content.replace("<MetricsTab ", "<MetricsTab formatPrice={formatPrice} convertToUsd={convert} ");
    content = content.replace("<BacktestModal ", "<BacktestModal setActiveJobId={setActiveJobId} setJobProgress={setJobProgress} ");
    fs.writeFileSync('app/admin/page.tsx', content);
}

fixAccuracy();
fixAuditor();
fixMetrics();
fixBacktestModal();
fixPage();
