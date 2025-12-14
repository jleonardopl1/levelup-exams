import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCareerCategories, useSubjects, CareerCategory } from '@/hooks/useCareerCategories';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Shield, Scale, Calculator, Landmark, Building2, GraduationCap, 
  HeartPulse, Laptop, BookOpen, ChevronRight, X, Sparkles,
  Brain, Gavel, FileText, Scroll, Users, Monitor, Lock, Code,
  Terminal, Database, Cloud, GitBranch, Settings, BarChart2, Activity,
  Stethoscope, Pill, Heart, Package, Archive, Presentation, ClipboardCheck,
  Briefcase, Receipt, Wallet, Search, TrendingUp, Leaf, PenTool, CheckCircle
} from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  'shield': <Shield className="w-6 h-6" />,
  'scale': <Scale className="w-6 h-6" />,
  'calculator': <Calculator className="w-6 h-6" />,
  'landmark': <Landmark className="w-6 h-6" />,
  'building-2': <Building2 className="w-6 h-6" />,
  'graduation-cap': <GraduationCap className="w-6 h-6" />,
  'heart-pulse': <HeartPulse className="w-6 h-6" />,
  'laptop': <Laptop className="w-6 h-6" />,
  'book-open': <BookOpen className="w-5 h-5" />,
  'brain': <Brain className="w-5 h-5" />,
  'gavel': <Gavel className="w-5 h-5" />,
  'file-text': <FileText className="w-5 h-5" />,
  'scroll': <Scroll className="w-5 h-5" />,
  'users': <Users className="w-5 h-5" />,
  'monitor': <Monitor className="w-5 h-5" />,
  'code': <Code className="w-5 h-5" />,
  'terminal': <Terminal className="w-5 h-5" />,
  'database': <Database className="w-5 h-5" />,
  'cloud': <Cloud className="w-5 h-5" />,
  'lock': <Lock className="w-5 h-5" />,
  'git-branch': <GitBranch className="w-5 h-5" />,
  'settings': <Settings className="w-5 h-5" />,
  'bar-chart-2': <BarChart2 className="w-5 h-5" />,
  'activity': <Activity className="w-5 h-5" />,
  'stethoscope': <Stethoscope className="w-5 h-5" />,
  'pill': <Pill className="w-5 h-5" />,
  'heart': <Heart className="w-5 h-5" />,
  'package': <Package className="w-5 h-5" />,
  'archive': <Archive className="w-5 h-5" />,
  'presentation': <Presentation className="w-5 h-5" />,
  'clipboard-check': <ClipboardCheck className="w-5 h-5" />,
  'briefcase': <Briefcase className="w-5 h-5" />,
  'receipt': <Receipt className="w-5 h-5" />,
  'wallet': <Wallet className="w-5 h-5" />,
  'search': <Search className="w-5 h-5" />,
  'trending-up': <TrendingUp className="w-5 h-5" />,
  'leaf': <Leaf className="w-5 h-5" />,
  'pen-tool': <PenTool className="w-5 h-5" />,
  'check-circle': <CheckCircle className="w-5 h-5" />,
  'building': <Building2 className="w-5 h-5" />,
  'book': <BookOpen className="w-5 h-5" />,
  'handshake': <Users className="w-5 h-5" />,
};

const categoryColors: Record<string, string> = {
  'Carreiras Policiais': 'from-blue-500 to-indigo-600',
  'Carreiras Jurídicas': 'from-purple-500 to-violet-600',
  'Área Fiscal e Controle': 'from-emerald-500 to-teal-600',
  'Bancária e Financeira': 'from-amber-500 to-orange-600',
  'Administração Pública': 'from-rose-500 to-pink-600',
  'Educação': 'from-cyan-500 to-sky-600',
  'Saúde': 'from-red-500 to-rose-600',
  'Tecnologia da Informação': 'from-violet-500 to-purple-600',
};

const categoryBgColors: Record<string, string> = {
  'Carreiras Policiais': 'bg-blue-500/10 border-blue-500/20',
  'Carreiras Jurídicas': 'bg-purple-500/10 border-purple-500/20',
  'Área Fiscal e Controle': 'bg-emerald-500/10 border-emerald-500/20',
  'Bancária e Financeira': 'bg-amber-500/10 border-amber-500/20',
  'Administração Pública': 'bg-rose-500/10 border-rose-500/20',
  'Educação': 'bg-cyan-500/10 border-cyan-500/20',
  'Saúde': 'bg-red-500/10 border-red-500/20',
  'Tecnologia da Informação': 'bg-violet-500/10 border-violet-500/20',
};

interface CareerCategorySelectorProps {
  onSubjectSelect?: (subjectId: string, subjectName: string) => void;
  hasReachedLimit?: boolean;
  onLimitReached?: () => void;
}

export function CareerCategorySelector({ 
  onSubjectSelect, 
  hasReachedLimit, 
  onLimitReached 
}: CareerCategorySelectorProps) {
  const navigate = useNavigate();
  const { data: categories, isLoading: loadingCategories } = useCareerCategories();
  const [selectedCategory, setSelectedCategory] = useState<CareerCategory | null>(null);
  const [showSubjectsModal, setShowSubjectsModal] = useState(false);
  
  const { data: subjects, isLoading: loadingSubjects } = useSubjects(selectedCategory?.id);

  const handleCategoryClick = (category: CareerCategory) => {
    setSelectedCategory(category);
    setShowSubjectsModal(true);
  };

  const handleSubjectClick = (subjectId: string, subjectName: string) => {
    if (hasReachedLimit) {
      onLimitReached?.();
      return;
    }
    
    if (onSubjectSelect) {
      onSubjectSelect(subjectId, subjectName);
    } else {
      navigate(`/quiz?subject=${subjectId}`);
    }
    setShowSubjectsModal(false);
  };

  if (loadingCategories) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="font-display font-bold text-lg">Escolha sua Área</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-muted/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="font-display font-bold text-lg">Escolha sua Área de Concurso</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {categories?.map((category, index) => (
          <button
            key={category.id}
            onClick={() => handleCategoryClick(category)}
            className="relative group text-left"
          >
            {/* Background blob */}
            <div className="absolute inset-0 overflow-hidden">
              <div 
                className={`absolute w-16 h-16 blur-xl opacity-30 ${
                  index % 4 === 0 ? '-top-2 -left-2 rounded-[60%_40%_50%_50%]' :
                  index % 4 === 1 ? '-top-2 -right-2 rounded-[40%_60%_50%_50%]' :
                  index % 4 === 2 ? '-bottom-2 -left-2 rounded-[50%_50%_60%_40%]' :
                  '-bottom-2 -right-2 rounded-[50%_50%_40%_60%]'
                } bg-gradient-to-br ${categoryColors[category.name] || 'from-primary to-accent'}`}
              />
            </div>

            <div className={`relative p-4 h-full min-h-[110px] backdrop-blur-sm border shadow-md 
              group-hover:shadow-lg group-hover:scale-[1.03] transition-all duration-300 
              ${categoryBgColors[category.name] || 'bg-card/95 border-border/50'}
              ${index % 4 === 0 ? 'rounded-[1.5rem_1rem_1.5rem_1rem]' :
                index % 4 === 1 ? 'rounded-[1rem_1.5rem_1rem_1.5rem]' :
                index % 4 === 2 ? 'rounded-[1rem_1.5rem_1rem_1.5rem]' :
                'rounded-[1.5rem_1rem_1.5rem_1rem]'}`}
            >
              <div className={`w-11 h-11 mb-3 flex items-center justify-center rounded-[45%_55%_50%_50%/55%_45%_55%_45%] 
                bg-gradient-to-br ${categoryColors[category.name] || 'from-primary to-accent'} text-white shadow-md`}>
                {iconMap[category.icon] || <BookOpen className="w-5 h-5" />}
              </div>
              <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors leading-tight">
                {category.name}
              </p>
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="w-4 h-4 text-primary" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Subjects Modal */}
      <Dialog open={showSubjectsModal} onOpenChange={setShowSubjectsModal}>
        <DialogContent className="max-w-md max-h-[85vh] p-0 overflow-hidden rounded-3xl">
          <DialogHeader className={`p-6 pb-4 bg-gradient-to-br ${categoryColors[selectedCategory?.name || ''] || 'from-primary to-accent'} text-white`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                  {selectedCategory && iconMap[selectedCategory.icon]}
                </div>
                <div>
                  <DialogTitle className="text-xl font-display font-bold text-white">
                    {selectedCategory?.name}
                  </DialogTitle>
                  <DialogDescription className="text-white/80 text-sm">
                    Selecione uma matéria para estudar
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="h-[50vh]">
            <div className="p-4 space-y-2">
              {loadingSubjects ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-14 bg-muted/50 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                subjects?.map((subject) => (
                  <button
                    key={subject.id}
                    onClick={() => handleSubjectClick(subject.id, subject.name)}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-card hover:bg-muted/50 
                      border border-border/50 hover:border-primary/30 transition-all duration-200 
                      group text-left"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center 
                      bg-gradient-to-br ${categoryColors[selectedCategory?.name || ''] || 'from-primary to-accent'} 
                      text-white shadow-sm`}>
                      {iconMap[subject.icon] || <BookOpen className="w-5 h-5" />}
                    </div>
                    <span className="flex-1 font-medium text-sm group-hover:text-primary transition-colors">
                      {subject.name}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                ))
              )}
              
              {!loadingSubjects && (!subjects || subjects.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma matéria disponível ainda</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
