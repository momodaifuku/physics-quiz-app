/**
 * 物理学 小テスト対策Webアプリケーション コントローラー (app.js)
 */

document.addEventListener("DOMContentLoaded", () => {
  const grader = new window.PhysicsEssayGrader();

  // 状態管理
  const state = {
    currentTab: "lecture",
    lectureFilter: "all",
    practiceFilter: "all",
    vocabFilter: "all",
    exam: {
      active: false,
      timerId: null,
      remainingSeconds: 15 * 60,
      questions: []
    },
    userAnswers: JSON.parse(localStorage.getItem("physics_quiz_answers") || "{}"),
    stats: JSON.parse(localStorage.getItem("physics_quiz_stats") || '{"answered": 0, "passed": 0}')
  };

  // DOM要素キャッシュ
  const elements = {
    tabs: document.querySelectorAll(".nav-tab-btn"),
    sections: {
      lecture: document.getElementById("section-lecture"),
      practice: document.getElementById("section-practice"),
      exam: document.getElementById("section-exam"),
      vocab: document.getElementById("section-vocab")
    },
    lectureAssignmentsContainer: document.getElementById("lecture-assignments-container"),
    practiceQuestionsContainer: document.getElementById("practice-questions-container"),
    vocabGridContainer: document.getElementById("vocab-grid-container"),
    examBanner: document.getElementById("exam-start-banner"),
    examTimer: document.getElementById("exam-timer"),
    timerDisplay: document.getElementById("timer-display"),
    btnStartExam: document.getElementById("btn-start-exam"),
    examQuestionsContainer: document.getElementById("exam-questions-container"),
    examResultContainer: document.getElementById("exam-result-container"),
    statAnsweredCount: document.getElementById("stat-answered-count"),
    statPassRate: document.getElementById("stat-pass-rate")
  };

  // ----------------------------------------------------
  // 統計更新
  // ----------------------------------------------------
  function updateStatsDisplay() {
    elements.statAnsweredCount.textContent = state.stats.answered;
    const rate = state.stats.answered > 0 
      ? Math.round((state.stats.passed / state.stats.answered) * 100) 
      : 0;
    elements.statPassRate.textContent = `${rate}%`;
    localStorage.setItem("physics_quiz_stats", JSON.stringify(state.stats));
  }

  function recordAnswer(isPassed) {
    state.stats.answered += 1;
    if (isPassed) {
      state.stats.passed += 1;
    }
    updateStatsDisplay();
  }

  // ----------------------------------------------------
  // タブ切り替え
  // ----------------------------------------------------
  elements.tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      elements.tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const targetTab = tab.getAttribute("data-tab");
      state.currentTab = targetTab;

      Object.keys(elements.sections).forEach(key => {
        elements.sections[key].style.display = key === targetTab ? "block" : "none";
      });

      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // ----------------------------------------------------
  // 講義内課題モードの描画
  // ----------------------------------------------------
  function renderLectureAssignments() {
    elements.lectureAssignmentsContainer.innerHTML = "";

    const filtered = QUIZ_DATA.lectureAssignments.filter(item => {
      if (state.lectureFilter === "all") return true;
      return item.lectureNumber === parseInt(state.lectureFilter);
    });

    filtered.forEach(assignment => {
      const card = document.createElement("div");
      card.className = "quiz-card";
      card.id = `card-${assignment.id}`;

      // カードヘッダー
      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-box">
            <h2>${assignment.title}</h2>
            <div class="card-subtitle">出題元：${assignment.slideRef}</div>
          </div>
          <span class="badge badge-primary">本番課題</span>
        </div>
      `;

      // 穴埋め問題セクション
      const fillInSection = renderFillInComponent(assignment.fillIn, `lec_${assignment.id}`);
      card.appendChild(fillInSection);

      // 文章作成問題セクション
      const essaySection = renderEssayComponent(assignment.essay, `lec_${assignment.id}`);
      card.appendChild(essaySection);

      elements.lectureAssignmentsContainer.appendChild(card);
    });
  }

  // ----------------------------------------------------
  // 穴埋めコンポーネント生成
  // ----------------------------------------------------
  function renderFillInComponent(fillInQuestion, prefix) {
    const container = document.createElement("div");
    container.className = "fill-in-container";

    let htmlTemplate = fillInQuestion.textTemplate;
    fillInQuestion.blanks.forEach(b => {
      const selectHtml = `
        <span class="fill-blank-select">
          <select class="blank-selector" id="${prefix}_blank_${b.index}" data-index="${b.index}">
            <option value="">（${b.label}を選択）</option>
            ${b.options.map(opt => `<option value="${opt}">${opt}</option>`).join("")}
          </select>
          <span class="blank-selector-arrow">▼</span>
        </span>
      `;
      htmlTemplate = htmlTemplate.replace(`{blank${b.index}}`, selectHtml);
    });

    container.innerHTML = `
      <div style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 8px;">
        ${fillInQuestion.title}
      </div>
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">
        ${fillInQuestion.instructions}
      </p>
      <div class="fill-in-box" id="${prefix}_fill_box">
        ${htmlTemplate}
      </div>
      <div class="btn-group">
        <button class="btn btn-secondary" id="${prefix}_btn_grade_fill">
          穴埋めを判定する
        </button>
      </div>
      <div id="${prefix}_fill_feedback" style="display: none; margin-top: 14px;"></div>
    `;

    // 採点イベント設定
    setTimeout(() => {
      const btn = document.getElementById(`${prefix}_btn_grade_fill`);
      if (btn) {
        btn.addEventListener("click", () => {
          const userChoices = {};
          fillInQuestion.blanks.forEach(b => {
            const sel = document.getElementById(`${prefix}_blank_${b.index}`);
            userChoices[b.index] = sel ? sel.value : "";
          });

          const result = grader.gradeFillIn(fillInQuestion, userChoices);
          displayFillInResult(prefix, result);
          recordAnswer(result.isAllCorrect);
        });
      }
    }, 0);

    return container;
  }

  function displayFillInResult(prefix, result) {
    const feedbackBox = document.getElementById(`${prefix}_fill_feedback`);
    if (!feedbackBox) return;

    // 各セレクトボックスの見た目更新
    result.blankResults.forEach(b => {
      const sel = document.getElementById(`${prefix}_blank_${b.index}`);
      if (sel) {
        sel.classList.remove("correct", "incorrect");
        if (b.isCorrect) {
          sel.classList.add("correct");
        } else {
          sel.classList.add("incorrect");
        }
      }
    });

    feedbackBox.style.display = "block";
    feedbackBox.innerHTML = `
      <div style="background: rgba(15, 23, 42, 0.9); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <strong style="color: #fff; font-size: 1rem;">穴埋め採点結果</strong>
          <span class="badge ${result.badgeClass}">${result.gradeLabel}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${result.blankResults.map(b => `
            <div style="font-size: 0.88rem; line-height: 1.5; color: ${b.isCorrect ? '#34d399' : '#f87171'};">
              <strong>${b.label}：正解「${b.correctAnswer}」</strong>
              ${!b.isCorrect ? ` (あなたの回答: ${b.userChoice})` : '（正解！）'}
              <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 2px;">
                💡 ${b.explanation}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------
  // 文章作成（記述問題）コンポーネント生成
  // ----------------------------------------------------
  function renderEssayComponent(essayQuestion, prefix) {
    const container = document.createElement("div");
    container.className = "essay-container";

    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
        <div style="font-size: 1rem; font-weight: 700; color: #fff;">
          ${essayQuestion.title}
        </div>
        <span class="badge badge-purple">スマート自動採点</span>
      </div>

      <div class="instructions-text">${essayQuestion.instructions}</div>

      <!-- 必須語句チェックバー -->
      <div class="required-keywords-bar">
        <div class="keywords-title">
          <span>📌 必須キーワード（入力すると自動で緑に点灯します）：</span>
        </div>
        <div class="keywords-chips" id="${prefix}_kw_chips">
          ${essayQuestion.requiredKeywords.map(kw => `
            <span class="kw-chip" id="${prefix}_kw_${encodeURIComponent(kw)}" data-keyword="${kw}">
              <span class="kw-icon"></span>
              <span>${kw}</span>
            </span>
          `).join("")}
        </div>
      </div>

      <!-- 入力エリア -->
      <div class="essay-textarea-wrapper">
        <textarea 
          class="essay-textarea" 
          id="${prefix}_essay_input" 
          placeholder="ここに解答を入力してください。スマホ・PCどちらからでも直接入力できます..."
        ></textarea>
        <div class="textarea-footer">
          <span id="${prefix}_char_count">0 文字</span>
          <span>判定基準：必須語句の網羅性 ＋ 物理法則の論理・必要条件</span>
        </div>
      </div>

      <div class="btn-group">
        <button class="btn btn-primary" id="${prefix}_btn_grade_essay">
          ⚡ 文章を自動採点する
        </button>
        <button class="btn btn-outline" id="${prefix}_btn_sample_input">
          模範解答をテスト入力
        </button>
      </div>

      <div id="${prefix}_essay_result"></div>
    `;

    // リアルタイム入力リスナー（文字数とキーワード点灯）
    setTimeout(() => {
      const textarea = document.getElementById(`${prefix}_essay_input`);
      const charCountSpan = document.getElementById(`${prefix}_char_count`);
      const btnGrade = document.getElementById(`${prefix}_btn_grade_essay`);
      const btnSample = document.getElementById(`${prefix}_btn_sample_input`);

      if (textarea) {
        const updateKeywordsHighlight = () => {
          const text = textarea.value;
          charCountSpan.textContent = `${text.length} 文字`;
          const norm = grader.normalizeText(text);

          essayQuestion.requiredKeywords.forEach(kw => {
            const chip = document.getElementById(`${prefix}_kw_${encodeURIComponent(kw)}`);
            if (chip) {
              if (grader.hasKeyword(norm, kw)) {
                chip.classList.add("matched");
              } else {
                chip.classList.remove("matched");
              }
            }
          });
        };

        textarea.addEventListener("input", updateKeywordsHighlight);

        // 模範解答テスト入力ボタン
        if (btnSample) {
          btnSample.addEventListener("click", () => {
            textarea.value = essayQuestion.modelAnswer;
            updateKeywordsHighlight();
            textarea.focus();
          });
        }

        // 採点実行ボタン
        if (btnGrade) {
          btnGrade.addEventListener("click", () => {
            const result = grader.gradeEssay(essayQuestion, textarea.value);
            displayEssayResult(prefix, result);
            recordAnswer(result.grade === "perfect");
          });
        }
      }
    }, 0);

    return container;
  }

  function displayEssayResult(prefix, result) {
    const resultBox = document.getElementById(`${prefix}_essay_result`);
    if (!resultBox) return;

    resultBox.innerHTML = `
      <div class="grading-result-panel">
        <div class="grading-header">
          <div>
            <span class="badge ${result.badgeClass}" style="font-size: 0.9rem; padding: 6px 14px;">
              ${result.gradeLabel}
            </span>
          </div>
          <div class="grading-score-badge" style="color: ${result.score >= 80 ? 'var(--accent-emerald)' : (result.score >= 50 ? 'var(--accent-amber)' : 'var(--accent-rose)')};">
            スコア：${result.score} <span style="font-size: 0.9rem; color: var(--text-dim);">/ 100点</span>
          </div>
        </div>

        <div style="font-size: 0.92rem; color: #f1f5f9; background: rgba(30, 41, 59, 0.4); padding: 12px; border-radius: var(--radius-sm); border-left: 4px solid var(--accent-cyan); margin-bottom: 16px;">
          <strong>📝 採点総評：</strong><br>
          ${result.summaryAdvice.replace(/\n/g, "<br>")}
        </div>

        <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">
          📊 採点基準ごとの必要条件判定チェックリスト：
        </div>

        <div class="criteria-list">
          ${result.criteriaResults.map(cr => `
            <div class="criterion-item ${cr.status}">
              <div class="criterion-top">
                <span>
                  ${cr.status === 'pass' ? '✅' : (cr.status === 'partial' ? '⚠️' : '❌')} ${cr.title}
                </span>
                <span style="font-size: 0.85rem;">
                  <strong>${cr.earnedPoints}</strong> / ${cr.maxPoints} 点
                </span>
              </div>
              <div style="color: var(--text-muted); font-size: 0.82rem; margin-top: 4px;">
                ${cr.feedback}
              </div>
            </div>
          `).join("")}
        </div>

        <div class="model-answer-accordion">
          <div class="model-answer-title" id="${prefix}_toggle_model_ans">
            <span>📖 模範解答と重要ポイントを確認する（タップで開閉）</span>
            <span style="font-size: 0.75rem;">▼</span>
          </div>
          <div class="model-answer-body" id="${prefix}_model_ans_body" style="display: block;">
            <div style="margin-bottom: 8px;">
              <strong style="color: var(--accent-cyan);">【模範解答】</strong><br>
              ${result.modelAnswer}
            </div>
            <div style="font-size: 0.85rem; color: var(--accent-amber); margin-top: 8px; border-top: 1px dashed var(--border-color); padding-top: 8px;">
              <strong>💡 解答作成のポイント：</strong> ${result.keyTakeaway}
            </div>
          </div>
        </div>
      </div>
    `;

    // アコーディオン開閉
    const toggleBtn = document.getElementById(`${prefix}_toggle_model_ans`);
    const modelBody = document.getElementById(`${prefix}_model_ans_body`);
    if (toggleBtn && modelBody) {
      toggleBtn.addEventListener("click", () => {
        modelBody.style.display = modelBody.style.display === "none" ? "block" : "none";
      });
    }

    resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ----------------------------------------------------
  // 予想問題演習モードの描画
  // ----------------------------------------------------
  function renderPracticeQuestions() {
    elements.practiceQuestionsContainer.innerHTML = "";

    const filtered = QUIZ_DATA.practiceQuestions.filter(item => {
      if (state.practiceFilter === "all") return true;
      return item.lectureNumber === parseInt(state.practiceFilter);
    });

    filtered.forEach(q => {
      const card = document.createElement("div");
      card.className = "quiz-card";
      card.id = `practice-card-${q.id}`;

      if (q.blanks) {
        // 穴埋め単体問題
        card.innerHTML = `
          <div class="card-header">
            <div class="card-title-box">
              <h2>${q.title}</h2>
              <div class="card-subtitle">第${q.lectureNumber}回 小テスト予想穴埋め問題</div>
            </div>
            <span class="badge badge-warning">小テスト予想</span>
          </div>
        `;
        const fillSec = renderFillInComponent(q, `prac_${q.id}`);
        card.appendChild(fillSec);
      } else {
        // 記述単体問題
        card.innerHTML = `
          <div class="card-header">
            <div class="card-title-box">
              <h2>${q.title}</h2>
              <div class="card-subtitle">第${q.lectureNumber}回 小テスト予想記述問題</div>
            </div>
            <span class="badge badge-purple">小テスト予想・記述</span>
          </div>
        `;
        const essaySec = renderEssayComponent(q, `prac_${q.id}`);
        card.appendChild(essaySec);
      }

      elements.practiceQuestionsContainer.appendChild(card);
    });
  }

  // ----------------------------------------------------
  // 重要語句マスターカードの描画
  // ----------------------------------------------------
  function renderVocabGrid() {
    elements.vocabGridContainer.innerHTML = "";

    const filtered = QUIZ_DATA.vocabularyList.filter(item => {
      if (state.vocabFilter === "all") return true;
      return item.lecture === parseInt(state.vocabFilter);
    });

    filtered.forEach(item => {
      const card = document.createElement("div");
      card.className = `vocab-card term-${item.colorTag}`;

      card.innerHTML = `
        <div class="vocab-top">
          <span class="vocab-term">${item.term}</span>
          <span class="badge ${item.colorTag === 'red' ? 'badge-danger' : (item.colorTag === 'orange' ? 'badge-warning' : 'badge-success')}">
            第${item.lecture}回 p.${item.page}
          </span>
        </div>
        ${item.formula && item.formula !== '-' ? `<div class="vocab-formula">${item.formula}</div>` : ''}
        <div class="vocab-summary">
          ${item.summary}
        </div>
        <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 8px;">
          ${item.detail}
        </div>
        <div class="vocab-tip">
          🎯 <strong>小テスト対策:</strong> ${item.examTip}
        </div>
      `;

      elements.vocabGridContainer.appendChild(card);
    });
  }

  // ----------------------------------------------------
  // 総合模擬テストロジック
  // ----------------------------------------------------
  function startMockExam() {
    state.exam.active = true;
    state.exam.remainingSeconds = 15 * 60;
    elements.examBanner.style.display = "none";
    elements.examTimer.style.display = "flex";
    elements.examQuestionsContainer.style.display = "block";
    elements.examResultContainer.style.display = "none";
    elements.examQuestionsContainer.innerHTML = "";

    // 模擬試験の問題を構成（穴埋め3問＋記述2問）
    const examQuestions = [
      { type: "fill", q: QUIZ_DATA.lectureAssignments[0].fillIn, ref: "第1回" },
      { type: "fill", q: QUIZ_DATA.lectureAssignments[1].fillIn, ref: "第2回" },
      { type: "fill", q: QUIZ_DATA.lectureAssignments[2].fillIn, ref: "第3回" },
      { type: "essay", q: QUIZ_DATA.lectureAssignments[0].essay, ref: "第1回 記述" },
      { type: "essay", q: QUIZ_DATA.lectureAssignments[2].essay, ref: "第3回 記述" }
    ];
    state.exam.questions = examQuestions;

    // 問題の描画
    examQuestions.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "quiz-card";
      card.id = `exam_q_card_${index}`;

      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-box">
            <h2>第${index + 1}問 [${item.ref}] ${item.q.title}</h2>
          </div>
          <span class="badge badge-primary">問題 ${index + 1} / 5</span>
        </div>
      `;

      if (item.type === "fill") {
        card.appendChild(renderFillInComponent(item.q, `exam_${index}`));
      } else {
        card.appendChild(renderEssayComponent(item.q, `exam_${index}`));
      }

      elements.examQuestionsContainer.appendChild(card);
    });

    // 試験終了ボタン
    const finishBar = document.createElement("div");
    finishBar.style.textAlign = "center";
    finishBar.style.marginTop = "30px";
    finishBar.innerHTML = `
      <button class="btn btn-primary" id="btn-finish-exam" style="padding: 14px 36px; font-size: 1.1rem;">
        🏁 模擬テストを終了して総合採点する
      </button>
    `;
    elements.examQuestionsContainer.appendChild(finishBar);

    document.getElementById("btn-finish-exam").addEventListener("click", finishMockExam);

    // タイマー開始
    clearInterval(state.exam.timerId);
    state.exam.timerId = setInterval(() => {
      state.exam.remainingSeconds -= 1;
      const m = Math.floor(state.exam.remainingSeconds / 60);
      const s = state.exam.remainingSeconds % 60;
      elements.timerDisplay.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

      if (state.exam.remainingSeconds <= 0) {
        clearInterval(state.exam.timerId);
        alert("試験時間が終了しました！採点を開始します。");
        finishMockExam();
      }
    }, 1000);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function finishMockExam() {
    clearInterval(state.exam.timerId);
    state.exam.active = false;
    elements.examTimer.style.display = "none";
    elements.examQuestionsContainer.style.display = "none";
    elements.examResultContainer.style.display = "block";

    // 総合スコア計算
    let totalScore = 0;
    const details = [];

    state.exam.questions.forEach((item, index) => {
      if (item.type === "fill") {
        const userChoices = {};
        item.q.blanks.forEach(b => {
          const sel = document.getElementById(`exam_${index}_blank_${b.index}`);
          userChoices[b.index] = sel ? sel.value : "";
        });
        const res = grader.gradeFillIn(item.q, userChoices);
        // 各穴埋め20点満点
        const questionScore = Math.round((res.correctCount / res.totalCount) * 20);
        totalScore += questionScore;
        details.push({
          title: `第${index + 1}問: ${item.q.title}`,
          score: questionScore,
          max: 20,
          pass: res.isAllCorrect
        });
      } else {
        const textarea = document.getElementById(`exam_${index}_essay_input`);
        const text = textarea ? textarea.value : "";
        const res = grader.gradeEssay(item.q, text);
        // 各記述20点満点に換算
        const questionScore = Math.round((res.score / 100) * 20);
        totalScore += questionScore;
        details.push({
          title: `第${index + 1}問: ${item.q.title}`,
          score: questionScore,
          max: 20,
          pass: res.grade === "perfect"
        });
      }
    });

    const isPassed = totalScore >= 70;
    recordAnswer(isPassed);

    elements.examResultContainer.innerHTML = `
      <div class="quiz-card" style="text-align: center; padding: 40px 20px;">
        <span class="badge ${isPassed ? 'badge-success' : 'badge-danger'}" style="font-size: 1.1rem; padding: 8px 24px; margin-bottom: 16px;">
          ${isPassed ? '🎉 合格基準達成！' : '⚠️ 不合格（要復習）'}
        </span>
        <h2 style="font-size: 2.2rem; font-weight: 800; color: #fff; margin: 12px 0;">
          総合得点：${totalScore} <span style="font-size: 1.2rem; color: var(--text-dim);">/ 100点</span>
        </h2>
        <p style="color: var(--text-muted); font-size: 0.95rem; max-width: 600px; margin: 0 auto 24px auto;">
          ${isPassed 
            ? '本番の小テストでも高得点が期待できます！色のついた重要語句を総復習してさらに万全にしましょう。' 
            : '小テスト合格ライン（70点）に届きませんでした。各講義の重要語句カードや講義内課題の模範解答を再確認してください。'}
        </p>

        <div style="max-width: 500px; margin: 0 auto 28px auto; text-align: left; display: flex; flex-direction: column; gap: 8px;">
          ${details.map(d => `
            <div style="background: var(--bg-input); padding: 10px 14px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.9rem;">${d.pass ? '✅' : '❌'} ${d.title}</span>
              <strong style="color: var(--accent-cyan);">${d.score} / ${d.max}点</strong>
            </div>
          `).join("")}
        </div>

        <div style="display: flex; gap: 12px; justify-content: center;">
          <button class="btn btn-primary" id="btn-retry-exam">もう一度模擬テストを受ける</button>
          <button class="btn btn-secondary" id="btn-back-to-lecture">講義内課題で復習する</button>
        </div>
      </div>
    `;

    document.getElementById("btn-retry-exam").addEventListener("click", () => {
      elements.examResultContainer.style.display = "none";
      elements.examBanner.style.display = "flex";
    });

    document.getElementById("btn-back-to-lecture").addEventListener("click", () => {
      document.getElementById("tab-btn-lecture").click();
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  elements.btnStartExam.addEventListener("click", startMockExam);

  // ----------------------------------------------------
  // フィルターボタンイベント
  // ----------------------------------------------------
  function setupFilterBar(containerId, stateKey, renderFn) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const chips = container.querySelectorAll(".filter-chip");
    chips.forEach(chip => {
      chip.addEventListener("click", () => {
        chips.forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        state[stateKey] = chip.getAttribute("data-filter");
        renderFn();
      });
    });
  }

  setupFilterBar("lecture-assignment-filters", "lectureFilter", renderLectureAssignments);
  setupFilterBar("practice-filters", "practiceFilter", renderPracticeQuestions);
  setupFilterBar("vocab-filters", "vocabFilter", renderVocabGrid);

  // ----------------------------------------------------
  // 初期レンダリング
  // ----------------------------------------------------
  updateStatsDisplay();
  renderLectureAssignments();
  renderPracticeQuestions();
  renderVocabGrid();
});
