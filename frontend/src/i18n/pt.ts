import type { WeekDay } from '../types';

// Source of truth for the interface vocabulary: en.ts is typed against this object, so a key
// added here without an English counterpart is a compile error rather than a blank label
// (spec 004 §9.1). Keys are named by area, not by their current text.
//
// The dataset's own text (exercise names, muscles, equipment, instructions) is NOT here — it
// is translated in the database and arrives already localized from the API (spec §4).
export const pt = {
  app: {
    name: 'WorkoutOrganizer',
  },

  common: {
    close: 'Fechar',
    back: 'Voltar',
    openMenu: 'Abrir menu',
    loading: 'Carregando',
    done: 'Concluído',
    language: 'Idioma',
    logout: 'Sair',
    cancel: 'Cancelar',
    yes: 'Sim',
    no: 'Não',
  },

  nav: {
    workouts: 'Meu treino',
    calendar: 'Calendário',
    muscleUse: 'Muscle Use',
  },

  weekDays: {
    full: {
      segunda: 'Segunda',
      terça: 'Terça',
      quarta: 'Quarta',
      quinta: 'Quinta',
      sexta: 'Sexta',
      sabado: 'Sábado',
      domingo: 'Domingo',
    } as Record<WeekDay, string>,
    short: {
      segunda: 'Seg',
      terça: 'Ter',
      quarta: 'Qua',
      quinta: 'Qui',
      sexta: 'Sex',
      sabado: 'Sáb',
      domingo: 'Dom',
    } as Record<WeekDay, string>,
    picker: 'Dia da semana',
  },

  months: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ],

  auth: {
    loginSubtitle: 'Entre para ver seus treinos',
    registerSubtitle: 'Crie sua conta para começar',
    username: 'Nome de usuário',
    password: 'Senha',
    submitting: 'Aguarde...',
    login: 'Entrar',
    register: 'Criar conta',
    toRegister: 'Não tem conta? Criar uma',
    toLogin: 'Já tem conta? Entrar',
    invalidCredentials: 'Usuário ou senha inválidos.',
    nameTaken: 'Esse nome de usuário já existe.',
    shortPassword: 'A senha precisa ter pelo menos 6 caracteres.',
    genericError: 'Algo deu errado. Tente novamente.',
    offline: 'Não foi possível conectar à API.',
  },

  workouts: {
    title: 'Meu treino',
    loadError: 'Não foi possível carregar seus treinos.',
    emptyTitle: 'Nenhum treino ainda',
    emptySubtitle: 'Toque no + para criar seu primeiro treino.',
    create: 'Criar treino',
    importWorkout: 'Importar documento',
    delete: (name: string) => `Excluir treino ${name}`,
    deleteTitle: (name: string) => `Excluir “${name}”?`,
    // The one place in the app where the count changes the sentence, so it is a function and
    // not a string — the plural cannot be glued on afterwards (spec 005 §4.4).
    deleteBody: (count: number) => {
      if (count === 0) return 'Este treino não tem exercícios. Não dá para desfazer.';
      const exercises = count === 1 ? '1 exercício' : `${count} exercícios`;
      return `${exercises} e todo o histórico de conclusão serão apagados. Não dá para desfazer.`;
    },
    deleteConfirm: 'Excluir',
    deleteError: 'Não foi possível excluir este treino.',
  },

  createWorkout: {
    title: 'Novo treino',
    tabManual: 'Montar manualmente',
    tabImport: 'Importar de documento',
    nameLabel: 'Nome do treino',
    namePlaceholder: 'Ex: Treino A - Peito e tríceps',
    creating: 'Criando...',
    submit: 'Criar treino',
    createError: 'Não foi possível criar o treino.',
    finish: 'Concluir',
    emptyDayTitle: 'Nenhum exercício neste dia',
    emptyDaySubtitle: 'Toque em “Adicionar exercício” para começar.',
    addExercise: '+ Adicionar exercício',
    dragHandle: 'Arrastar para reordenar',
    editExercise: 'Editar exercício',
    deleteExercise: 'Excluir exercício',
    deleteError: 'Não foi possível excluir o exercício.',
    reorderError: 'Não foi possível salvar a nova ordem.',
    importTitle: 'Importar ficha ou documento',
    importSubtitle: 'Envie uma foto, PDF ou planilha do seu treino',
    importDropzone: 'Arraste seu arquivo aqui ou toque para selecionar',
    aiDisclaimerNotice: 'A IA pode cometer erros, por favor, revise.',
    importAcceptedFormats: 'Fotos, PDFs ou planilhas (XLSX, CSV)',
    importSelectFile: 'Selecionar arquivo',
    importChangeFile: 'Trocar arquivo',
    importSubmit: 'Processar documento',
    importingState1: 'Lendo documento...',
    importingState2: 'Identificando exercícios e séries com IA...',
    importingState3: 'Estruturando dias e montando seu treino...',
    importDegradedNotice: 'Este arquivo foi lido em modo degradado — confira os exercícios com atenção.',
    // Rows kept under the sheet's own name because the catalog had nothing similar (spec 0010 §6.3).
    importCustomNotice: (count: number) =>
      count === 1
        ? '1 exercício não foi identificado no catálogo e entrou com o nome da ficha.'
        : `${count} exercícios não foram identificados no catálogo e entraram com o nome da ficha.`,
    importErrorUnreadable: 'Não foi possível identificar uma rotina de treino neste arquivo.',
    importErrorGeneric: 'Erro ao processar o documento. Tente novamente.',
    importErrorTooLarge: 'O arquivo excede o limite máximo permitido de 15 MB.',
  },

  workoutView: {
    fallbackTitle: 'Treino',
    loadError: 'Não foi possível carregar este treino.',
    markError: 'Não foi possível marcar esse exercício como feito. Tente novamente.',
    emptyDayTitle: 'Nenhum exercício neste dia',
    emptyDaySubtitle: 'Este treino não tem exercícios atribuídos a esse dia.',
    next: 'Próximo',
    confirmQuestion: 'Deseja concluir o exercício?',
  },

  celebration: {
    title: 'Treino do dia concluído!',
    subtitle: 'Você terminou todos os exercícios de hoje. Mandou bem!',
  },

  notes: {
    title: 'Como foi?',
    textLabel: 'Observação',
    textPlaceholder: 'Ex: banco 2 furos mais alto, última série falhou na 10...',
    weightLabel: 'Peso por série',
    unit: 'kg',
    // Positional labels, so they are ordinals — and an English ordinal is not `${n}th`.
    setLabel: (n: number) => `${n}ª série`,
    removeSet: (n: number) => `Remover ${n}ª série`,
    addSet: '+ Adicionar série',
    skip: 'Pular',
    save: 'Salvar',
    chip: (weight: number) => `Última anotação: ${weight} kg`,
    chipEmpty: 'Ver última anotação',
    lastTime: (date: string) => `Última vez · ${date}`,
    delete: 'Excluir anotação',
    weightError: 'Cada peso precisa ser um número entre 0 e 1000 kg.',
    saveError: 'Não foi possível salvar a anotação.',
    deleteError: 'Não foi possível excluir a anotação.',
  },

  calendar: {
    title: 'Calendário',
    loadError: 'Não foi possível carregar o calendário.',
    previousMonth: 'Mês anterior',
    nextMonth: 'Próximo mês',
    legendCompleted: 'Concluído',
    legendScheduled: 'Com treino',
    emptyTitle: 'Nada agendado para este dia',
    emptySubtitle: 'Nenhum treino tem exercícios atribuídos a esse dia.',
  },

  exerciseCard: {
    viewToggle: 'Alternar entre gif e detalhes',
    gif: 'Gif',
    details: 'Detalhes',
    noGif: 'Sem gif disponível',
    steps: (count: number) => `Passo a passo (${count})`,
    customBadge: 'Fora do catálogo — nenhum exercício similar identificado',
  },

  media: {
    none: 'Sem mídia',
    toggle: 'Foto ou GIF',
    photo: 'Foto',
    gif: 'GIF',
  },

  picker: {
    dialogLabel: (day: string) => `Adicionar exercício - ${day}`,
    heading: (day: string) => `Adicionar em ${day}`,
    searchPlaceholder: 'Buscar por nome, categoria...',
    groupFilter: 'Filtrar por grupo muscular',
    allGroups: 'Todos os grupos',
    searchError: 'Não foi possível buscar exercícios.',
    noResults: 'Nenhum exercício encontrado.',
    previous: 'Anterior',
    next: 'Próxima',
    pagination: (page: number, totalPages: number, totalCount: number) =>
      `Página ${page} de ${totalPages} · ${totalCount} exercícios`,
  },

  exerciseDetail: {
    dialogLabel: (name: string) => `Detalhes de ${name}`,
    category: 'Categoria',
    bodyPart: 'Parte do corpo',
    muscleGroup: 'Grupo muscular',
    target: 'Alvo',
    equipment: 'Equipamento',
    instructions: 'Instruções',
    steps: 'Passo a passo',
    formTitle: 'Séries e observações',
    sets: 'Séries',
    reps: 'Repetições',
    note: 'Observação (opcional)',
    notePlaceholder: 'Ex: carga, cadência, ajuste do banco...',
    needReps: 'Informe também as repetições.',
    needSets: 'Informe também as séries.',
    addError: 'Não foi possível adicionar o exercício.',
    add: 'Adicionar exercício',
    save: 'Salvar',
    swap: 'Trocar exercício',
    saveError: 'Não foi possível salvar as alterações.',
  },

  customExercise: {
    dialogLabel: (name: string) => `Editar ${name}`,
    nameLabel: 'Nome do exercício',
    notInCatalog: 'Este exercício não está no catálogo. Você pode manter o nome ou trocar por um do catálogo.',
    needName: 'Informe o nome do exercício.',
  },

  muscleUse: {
    title: 'Muscle Use',
    loadError: 'Não foi possível carregar o mapa muscular.',
    viewGroup: 'Vista do corpo',
    front: 'Frente',
    back: 'Costas',
    emptyTitle: 'Nenhum dado ainda',
    emptySubtitle: 'Adicione exercícios aos seus treinos para ver quais músculos são mais trabalhados.',
    exerciseCount: (count: number) => `${count} ${count === 1 ? 'exercício' : 'exercícios'}`,
    heatmapLabel: (view: string) => `Mapa muscular, vista ${view.toLowerCase()}`,
    panelTitle: 'Mais trabalhados',
    clearFilter: 'Limpar filtro por região',
    noMuscleInRegion: 'Nenhum músculo do seu plano atinge essa região.',
    roles: (primary: number, secondary: number) =>
      `${primary} como principal · ${secondary} como secundário`,
    less: 'menos',
    more: 'mais',
    explanation:
      'Cada exercício dá 2 pontos ao músculo principal e 1 a cada secundário, somando todos os seus treinos. O músculo mais trabalhado é sempre a cor mais forte.',
    ignoredNote: (count: number, label: string) =>
      `${count} ${count === 1 ? 'exercício não aparece' : 'exercícios não aparecem'} no mapa: ${label.toLowerCase()} não é uma região do corpo.`,
  },
};

export type Dictionary = typeof pt;
