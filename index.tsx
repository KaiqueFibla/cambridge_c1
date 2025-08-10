// Espera o DOM ser totalmente carregado antes de executar o script
document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURAÇÕES GERAIS E CONSTANTES ---
    
    // Define o número máximo de questões para cada parte para validação de input
    const PART_MAX_QUESTIONS = {
        reading: { part1: 8, part5: 6, part6: 4, part7: 6, part8: 10 },
        useOfEnglish: { part2: 8, part3: 8, part4: 6 }
    };

    // Interface para a configuração das seções com múltiplas partes (Reading, Use of English)
    interface SectionConfig {
        inputs: Record<string, HTMLInputElement>;
        displays: {
            raw: HTMLElement | null;
            scaled: HTMLElement | null;
            cefr: HTMLElement | null;
        };
        weights: Record<string, number>;
        anchors: Array<{raw: number, scaled: number}>;
        maxRawScore: number;
        maxQuestions: Record<string, number>;
    }

    // --- CONFIGURAÇÕES DE PONTUAÇÃO (ANCHORS) POR SEÇÃO ---

    const READING_CONFIG: SectionConfig = {
        inputs: {
            part1: document.getElementById('part1') as HTMLInputElement,
            part5: document.getElementById('part5') as HTMLInputElement,
            part6: document.getElementById('part6') as HTMLInputElement,
            part7: document.getElementById('part7') as HTMLInputElement,
            part8: document.getElementById('part8') as HTMLInputElement,
        },
        displays: {
            raw: document.getElementById('raw-score-value-reading'),
            scaled: document.getElementById('scaled-score-value-reading'),
            cefr: document.getElementById('cefr-level-value-reading'),
        },
        weights: { part1: 1, part5: 2, part6: 2, part7: 2, part8: 1 },
        anchors: [
            { raw: 17, scaled: 142 }, { raw: 23, scaled: 160 }, { raw: 32, scaled: 180 },
            { raw: 43, scaled: 200 }, { raw: 50, scaled: 210 },
        ],
        maxRawScore: 50,
        maxQuestions: PART_MAX_QUESTIONS.reading,
    };

    const UOE_CONFIG: SectionConfig = {
        inputs: {
            part2: document.getElementById('part2') as HTMLInputElement,
            part3: document.getElementById('part3') as HTMLInputElement,
            part4: document.getElementById('part4') as HTMLInputElement,
        },
        displays: {
            raw: document.getElementById('raw-score-value-uoe'),
            scaled: document.getElementById('scaled-score-value-uoe'),
            cefr: document.getElementById('cefr-level-value-uoe'),
        },
        weights: { part2: 1, part3: 1, part4: 2 },
        anchors: [
            { raw: 8, scaled: 142 }, { raw: 11, scaled: 160 }, { raw: 16, scaled: 180 },
            { raw: 23, scaled: 200 }, { raw: 28, scaled: 210 },
        ],
        maxRawScore: 28,
        maxQuestions: PART_MAX_QUESTIONS.useOfEnglish,
    };

    const LISTENING_ANCHORS = [
        { raw: 0, scaled: 120 }, { raw: 12, scaled: 159 }, { raw: 13, scaled: 160 },
        { raw: 17, scaled: 179 }, { raw: 18, scaled: 180 }, { raw: 25, scaled: 199 },
        { raw: 26, scaled: 200 }, { raw: 30, scaled: 210 },
    ];

    const SPEAKING_ANCHORS = [
        { raw: 0,  scaled: 80 }, { raw: 30, scaled: 160 }, { raw: 45, scaled: 180 },
        { raw: 66, scaled: 200 }, { raw: 75, scaled: 210 }
    ];

    const WRITING_ANCHORS = [
        { raw: 0,  scaled: 122 }, { raw: 15, scaled: 159 }, { raw: 16, scaled: 160 },
        { raw: 23, scaled: 179 }, { raw: 24, scaled: 180 }, { raw: 33, scaled: 199 },
        { raw: 34, scaled: 200 }, { raw: 40, scaled: 210 }
    ];


    // --- FUNÇÕES DE CÁLCULO E LÓGICA GENÉRICAS ---

    /**
     * Calcula a pontuação bruta para seções com múltiplas partes.
     */
    function calculateRawScore(inputs: Record<string, HTMLInputElement>, weights: Record<string, number>): number {
        return Object.keys(inputs).reduce((total, key) => {
            const input = inputs[key];
            const value = Number(input?.value) || 0;
            return total + (value * (weights[key] || 0));
        }, 0);
    }

    /**
     * Realiza a interpolação linear entre dois pontos.
     */
    function interpolate(x: number, x1: number, y1: number, x2: number, y2: number): number {
        if (x1 === x2) return y1;
        return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
    }

    /**
     * Converte uma pontuação bruta para a pontuação na escala Cambridge usando os marcos (anchors).
     */
    function convertToScaledScore(rawScore: number, anchors: Array<{raw: number, scaled: number}>): number {
        if (rawScore <= anchors[0].raw) return anchors[0].scaled;
        if (rawScore >= anchors[anchors.length - 1].raw) return anchors[anchors.length - 1].scaled;

        for (let i = 0; i < anchors.length - 1; i++) {
            const start = anchors[i];
            const end = anchors[i + 1];
            if (rawScore >= start.raw && rawScore <= end.raw) {
                const scaled = interpolate(rawScore, start.raw, start.scaled, end.raw, end.scaled);
                return Math.round(scaled);
            }
        }
        return anchors[0].scaled; // Fallback, não deve ser atingido em condições normais
    }

    /**
     * Determina o nível CEFR, a grade e a classe CSS com base na pontuação da escala.
     * @param {number} scaledScore - A pontuação na escala Cambridge.
     * @param {boolean} isOverall - Se o cálculo é para o score final (overall).
     */
    function getGradeAndCefr(scaledScore: number, isOverall = false): { grade: string; cefr: string; className: string } {
        if (scaledScore >= 200) return { grade: isOverall ? 'Pass Grade A' : 'C2 Level', cefr: 'C2', className: 'cefr-c2' };
        if (scaledScore >= 193 && isOverall) return { grade: 'Pass Grade B', cefr: 'C1', className: 'cefr-c1' };
        if (scaledScore >= 180) return { grade: isOverall ? 'Pass Grade C' : 'C1 Level', cefr: 'C1', className: 'cefr-c1' };
        if (scaledScore >= 160) return { grade: 'B2 Level', cefr: 'B2', className: 'cefr-b2' };
        return { grade: 'Below B2 Level', cefr: 'Abaixo de B2', className: 'cefr-below-b2' };
    }


    // --- FUNÇÃO DE ATUALIZAÇÃO DA UI GENÉRICA ---

    function updateUi(displays: SectionConfig['displays'], rawScore: number, maxRawScore: number, scaledScore: number, gradeInfo: {cefr: string, className: string}) {
        if (displays.raw) displays.raw.textContent = `${rawScore.toFixed(rawScore % 1 === 0 ? 0 : 1)} / ${maxRawScore}`;
        if (displays.scaled) displays.scaled.textContent = String(scaledScore);
        if (displays.cefr) {
            displays.cefr.textContent = gradeInfo.cefr;
            displays.cefr.className = `cefr-badge ${gradeInfo.className}`;
        }
    }


    // --- VALIDAÇÃO E ORQUESTRAÇÃO POR SEÇÃO ---

    /**
     * Valida se os marcos de pontuação são estritamente crescentes para garantir a lógica de interpolação.
     */
    function validateAnchors(anchors: Array<{raw: number, scaled: number}>, sectionName: string): boolean {
        for (let i = 0; i < anchors.length - 1; i++) {
            if (anchors[i].raw >= anchors[i+1].raw || anchors[i].scaled > anchors[i+1].scaled) {
                console.error(`Configuração de anchors inválida para ${sectionName}: os marcos devem ser crescentes.`, anchors[i], anchors[i+1]);
                return false;
            }
        }
        return true;
    }
    
    /**
     * Atualiza os scores para seções com múltiplas partes (Reading, UoE).
     */
    function updateMultiPartSection(config: SectionConfig) {
        const rawScore = calculateRawScore(config.inputs, config.weights);
        const scaledScore = convertToScaledScore(rawScore, config.anchors);
        const gradeInfo = getGradeAndCefr(scaledScore);
        updateUi(config.displays, rawScore, config.maxRawScore, scaledScore, gradeInfo);
    }
    
    /**
     * Atualiza os scores para seções com um único input (Listening, Writing).
     */
    function updateSingleInputSection(inputId: string, displays: SectionConfig['displays'], anchors: any[], maxRawScore: number) {
        const input = document.getElementById(inputId) as HTMLInputElement;
        if (!input || !displays.raw || !displays.scaled || !displays.cefr) return;
        
        const rawScore = Number(input.value) || 0;
        const scaledScore = convertToScaledScore(rawScore, anchors);
        const gradeInfo = getGradeAndCefr(scaledScore);

        updateUi(displays, rawScore, maxRawScore, scaledScore, gradeInfo);
    }

    /**
     * Valida um campo de input, aplicando limites e exibindo mensagens de erro.
     */
    function validateInput(input: HTMLInputElement, max: number, allowHalfStep = false) {
        const errorElement = document.getElementById(input.getAttribute('aria-describedby') || '');
        let valueStr = input.value;

        const showError = (message: string) => {
             if (errorElement) {
                errorElement.textContent = message;
                errorElement.classList.add('visible');
            }
            input.classList.add('invalid');
        };

        const clearError = () => {
            if (errorElement) {
                errorElement.textContent = '';
                errorElement.classList.remove('visible');
            }
            input.classList.remove('invalid');
        };

        if (valueStr === '') {
            clearError();
            return;
        }

        let value = parseFloat(valueStr);

        if (isNaN(value)) {
            showError("Valor inválido.");
            return;
        }

        if (allowHalfStep && !Number.isInteger(value * 2)) {
            showError("Use incrementos de 0.5.");
            return;
        } else if (!allowHalfStep && !Number.isInteger(value)) {
            showError("Insira um número inteiro.")
            return;
        }
        
        if (value < 0) {
            input.value = '0';
            value = 0;
        } else if (value > max) {
            input.value = String(max);
            value = max;
        }
        
        clearError();
    }


    // --- LÓGICA DAS SEÇÕES SPEAKING E OVERALL ---

    const speakingComponentInputs = {
        gr: document.getElementById('gr') as HTMLInputElement, lr: document.getElementById('lr') as HTMLInputElement,
        dm: document.getElementById('dm') as HTMLInputElement, pr: document.getElementById('pr') as HTMLInputElement,
        ic: document.getElementById('ic') as HTMLInputElement, ga: document.getElementById('ga') as HTMLInputElement,
    };
    const speakingTotalInput = document.getElementById('speaking-total-score') as HTMLInputElement;
    
    function updateSpeakingScores() {
        const mode = (document.querySelector('input[name="speaking-mode"]:checked') as HTMLInputElement).value;
        const displays = {
            raw: document.getElementById('raw-score-value-speaking'),
            scaled: document.getElementById('scaled-score-value-speaking'),
            cefr: document.getElementById('cefr-level-value-speaking'),
        };
        const formulaDisplay = document.getElementById('speaking-formula');
        const maxRawScore = 75;
        let rawScore = 0;

        if (mode === 'components') {
            const { ga, ...criteria } = speakingComponentInputs;
            const criteriaValues = Object.values(criteria).map(input => Number(input.value) || 0);
            const criteriaSum = criteriaValues.reduce((sum, v) => sum + v, 0);
            const gaValue = Number(ga.value) || 0;
            rawScore = (criteriaSum * 2) + (gaValue * 5);
            
            // Atualiza a fórmula dinamicamente
            if (formulaDisplay) {
                const criteriaStr = Object.values(criteria).map(i => (Number(i.value) || 0).toFixed(1)).join('+');
                formulaDisplay.textContent = `(${criteriaStr})*2 + (${gaValue.toFixed(1)})*5`;
            }
        } else {
            rawScore = Number(speakingTotalInput.value) || 0;
            if (formulaDisplay) formulaDisplay.textContent = 'Total bruto inserido diretamente';
        }

        const scaledScore = convertToScaledScore(rawScore, SPEAKING_ANCHORS);
        const gradeInfo = getGradeAndCefr(scaledScore);
        
        updateUi(displays, rawScore, maxRawScore, scaledScore, gradeInfo);
    }
    
    function calculateOverallScore() {
        const scoreIds = [
            { id: 'scaled-score-value-reading', name: 'Reading' }, { id: 'scaled-score-value-uoe', name: 'Use of English' },
            { id: 'scaled-score-value-listening', name: 'Listening' }, { id: 'scaled-score-value-writing', name: 'Writing' },
            { id: 'scaled-score-value-speaking', name: 'Speaking' }
        ];
        
        const resultsContainer = document.getElementById('overall-results-container');
        const errorDisplay = document.getElementById('overall-error-message');
        const overallScoreDisplay = document.getElementById('overall-score-value');
        const overallGradeDisplay = document.getElementById('overall-grade-value');
        const overallCefrDisplay = document.getElementById('overall-cefr-value');

        if (!resultsContainer || !errorDisplay || !overallScoreDisplay || !overallGradeDisplay || !overallCefrDisplay) return;

        const scores: number[] = [];
        const missingSections: string[] = [];

        scoreIds.forEach(item => {
            const element = document.getElementById(item.id);
            const score = Number(element?.textContent);
            if (!element?.textContent || isNaN(score) || score === 0) {
                missingSections.push(item.name);
            } else {
                scores.push(score);
            }
        });

        if (missingSections.length > 0) {
            resultsContainer.classList.add('hidden');
            errorDisplay.textContent = `Por favor, preencha as seções: ${missingSections.join(', ')}.`;
            errorDisplay.classList.add('visible');
            return;
        }

        const totalScore = scores.reduce((sum, score) => sum + score, 0);
        const overallScore = Math.round(totalScore / scores.length);
        const { grade, cefr, className } = getGradeAndCefr(overallScore, true);

        overallScoreDisplay.textContent = String(overallScore);
        overallGradeDisplay.textContent = grade;
        overallCefrDisplay.textContent = cefr;
        overallCefrDisplay.className = `cefr-badge ${className}`;

        resultsContainer.classList.remove('hidden');
        errorDisplay.classList.remove('visible');
        errorDisplay.textContent = '';
    }


    // --- EVENT LISTENERS (VINCULAÇÃO DE EVENTOS AOS ELEMENTOS) ---
    
    // Adiciona listeners para seções com múltiplas partes
    [READING_CONFIG, UOE_CONFIG].forEach(config => {
        Object.entries(config.inputs).forEach(([key, input]) => {
            if (input) {
                input.addEventListener('input', () => {
                    validateInput(input, config.maxQuestions[key]);
                    updateMultiPartSection(config);
                });
            }
        });
    });

    // Adiciona listeners para seções com um único input
    const singleInputSections = [
        { id: 'listening-score', displays: { raw: document.getElementById('raw-score-value-listening'), scaled: document.getElementById('scaled-score-value-listening'), cefr: document.getElementById('cefr-level-value-listening') }, anchors: LISTENING_ANCHORS, max: 30 },
        { id: 'writing-score', displays: { raw: document.getElementById('raw-score-value-writing'), scaled: document.getElementById('scaled-score-value-writing'), cefr: document.getElementById('cefr-level-value-writing') }, anchors: WRITING_ANCHORS, max: 40 },
    ];
    singleInputSections.forEach(s => {
        const input = document.getElementById(s.id);
        if (input) {
            input.addEventListener('input', () => {
                validateInput(input as HTMLInputElement, s.max);
                updateSingleInputSection(s.id, s.displays, s.anchors, s.max);
            });
        }
    });

    // Adiciona listeners para a seção Speaking
    document.querySelectorAll('input[name="speaking-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const mode = (e.target as HTMLInputElement).value;
            document.getElementById('speaking-components-section')?.classList.toggle('hidden', mode !== 'components');
            document.getElementById('speaking-total-section')?.classList.toggle('hidden', mode !== 'total');
            updateSpeakingScores();
        });
    });

    Object.values(speakingComponentInputs).forEach(input => {
        input.addEventListener('input', () => { validateInput(input, 5, true); updateSpeakingScores(); });
    });

    speakingTotalInput.addEventListener('input', () => { validateInput(speakingTotalInput, 75, true); updateSpeakingScores(); });

    // Adiciona listener para o botão de cálculo do Overall Score
    document.getElementById('calculate-overall-btn')?.addEventListener('click', calculateOverallScore);


    // --- INICIALIZAÇÃO DA APLICAÇÃO ---
    
    // Valida todas as configurações de anchor no início para segurança
    validateAnchors(READING_CONFIG.anchors, "Reading");
    validateAnchors(UOE_CONFIG.anchors, "Use of English");
    validateAnchors(LISTENING_ANCHORS, "Listening");
    validateAnchors(SPEAKING_ANCHORS, "Speaking");
    validateAnchors(WRITING_ANCHORS, "Writing");

    // Executa os cálculos uma vez no carregamento para inicializar a UI com valores padrão
    updateMultiPartSection(READING_CONFIG);
    updateMultiPartSection(UOE_CONFIG);
    updateSingleInputSection('listening-score', singleInputSections[0].displays, LISTENING_ANCHORS, 30);
    updateSingleInputSection('writing-score', singleInputSections[1].displays, WRITING_ANCHORS, 40);
    updateSpeakingScores();

    // Inicializa a visibilidade do resultado final
    document.getElementById('overall-results-container')?.classList.add('hidden');
});