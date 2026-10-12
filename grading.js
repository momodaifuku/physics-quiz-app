/**
 * 物理学 記述式（文章作成問題）スマート自動採点エンジン
 * 
 * 機能：
 * 1. 必須キーワードの網羅性チェック（表記ゆれ・同義語対応）
 * 2. 禁止語句・トラップ語句の文脈検証（例：光子が適切に除外・言及されているか）
 * 3. 物理学的な必要条件・因果関係・論理整合性のセマンティック検証
 * 4. 項目別達成チェックリスト、スコア、アドバイス、模範解答の即時フィードバック生成
 */

class PhysicsEssayGrader {
  constructor() {
    // 同義語・表記揺れ辞書
    this.synonymMap = {
      "運動方程式": ["運動方程式", "運動の法則", "m a = F", "ma=F", "m d²r/dt² = F", "md^2r/dt^2=F"],
      "楕円軌道": ["楕円軌道", "楕円", "ケプラー軌道"],
      "近日点の移動": ["近日点の移動", "近日点移動", "近日点が移動", "近日点の位置がずれる", "近日点がずれる"],
      "クォーク": ["クォーク", "クオーク", "quark"],
      "グルーオン": ["グルーオン", "グルオン", "gluon"],
      "光子": ["光子", "フォトン", "photon"],
      "自由落下": ["自由落下", "落体の運動", "落下する"],
      "空間並進対称性": ["空間並進対称性", "空間並進対称", "空間の並進対称性", "並進対称性", "空間の一様性"],
      "運動量": ["運動量", "p=mv", "p=m*v"],
      "時間並進対称性": ["時間並進対称性", "時間並進対称", "時間の並進対称性", "時間の一様性"],
      "力学的エネルギー": ["力学的エネルギー", "全エネルギー", "運動エネルギーと位置エネルギーの和"],
      "位置エネルギー": ["位置エネルギー", "ポテンシャルエネルギー", "U(y)", "U(r)", "mgy"],
      "反物質": ["反物質", "反粒子", "アンチマター"],
      "陽電子": ["陽電子", "ポジトロン"],
      "対消滅": ["対消滅", "ペア消滅", "消滅する"],
      "対称性の破れ": ["対称性の破れ", "対称性が破れて", "対称性が破れる", "対称性が崩れ", "非対称"],
      "数理モデル": ["数理モデル", "数学的モデル", "数理的モデル"],
      "解析解": ["解析解", "厳密解", "数学的な解", "手計算の解"],
      "数値解": ["数値解", "数値計算の解", "計算機による解"],
      "オイラー法": ["オイラー法", "オイラーの手法", "euler法"]
    };
  }

  /**
   * テキストの標準化
   */
  normalizeText(text) {
    if (!text) return "";
    return text
      .toLowerCase()
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .replace(/\r\n|\r/g, "\n")
      .replace(/[ \t　]+/g, " ")
      .trim();
  }

  /**
   * キーワードが含まれているか（表記揺れ吸収）
   */
  hasKeyword(normalizedText, targetKeyword) {
    const variants = this.synonymMap[targetKeyword] || [targetKeyword];
    for (const v of variants) {
      const normV = this.normalizeText(v);
      if (normalizedText.includes(normV)) {
        return true;
      }
    }
    return false;
  }

  /**
   * トラップ語句（第2回の「光子」など）の文脈検査
   * 「光子は不要」「光子は電磁気力を媒介するため使わない」等なら合格、
   * 「光子によってクォークが結びつく」ならNG
   */
  checkProhibitedKeywordContext(normalizedText, prohibitedWord) {
    if (!this.hasKeyword(normalizedText, prohibitedWord)) {
      // そもそも使っていなければOK（指示通り必要な語句のみ使った）
      return {
        used: false,
        isContextAppropriate: true,
        message: `指定された選択語句のうち「${prohibitedWord}」を適切に除外できています。`
      };
    }

    // 「光子」が含まれている場合、文脈をチェック
    const safePatterns = [
      /光子.*(?:不要|使わな|用いない|関係な|関与しな|除外|必要.*ない|対象外)/,
      /光子.*(?:電磁気力|電磁気|クーロン)/,
      /(?:電磁気力|電磁気).*光子/
    ];

    const isAppropriate = safePatterns.some(pattern => pattern.test(normalizedText));
    if (isAppropriate) {
      return {
        used: true,
        isContextAppropriate: true,
        message: `「${prohibitedWord}」について、電磁気力の媒介粒子であり中性子内部のクォーク結合には関与しない旨が正しく言及されています。`
      };
    } else {
      return {
        used: true,
        isContextAppropriate: false,
        message: `注意：「${prohibitedWord}」が中性子内部の力として使われているか、不要な言及となっている可能性があります。光子は電磁気力を媒介する粒子であり、クォークを結びつける強い力は「グルーオン」です。`
      };
    }
  }

  /**
   * 基準ごとのセマンティック充足度チェック
   */
  evaluateCriterion(normalizedText, criterion) {
    const groups = criterion.keywordsAny; // [[k1, k2], [k3, k4]] すべてのグループから1つ以上マッチ
    let matchedGroupsCount = 0;
    const missingGroupHints = [];

    for (let i = 0; i < groups.length; i++) {
      const candidates = groups[i];
      const hasMatch = candidates.some(word => {
        const normW = this.normalizeText(word);
        return normalizedText.includes(normW);
      });

      if (hasMatch) {
        matchedGroupsCount++;
      } else {
        missingGroupHints.push(`「${candidates[0]}」などに関する記述`);
      }
    }

    const matchRatio = matchedGroupsCount / groups.length;
    let earnedPoints = 0;
    let status = "fail"; // 'pass', 'partial', 'fail'
    let feedback = "";

    if (matchRatio === 1.0) {
      earnedPoints = criterion.points;
      status = "pass";
      feedback = "必要条件を満たしています。";
    } else if (matchRatio >= 0.5) {
      earnedPoints = Math.round(criterion.points * matchRatio * 0.8);
      status = "partial";
      feedback = `一部言及されていますが、${missingGroupHints.join("、")}が不足しています。`;
    } else {
      earnedPoints = 0;
      status = "fail";
      feedback = `${criterion.title}についての明確な説明が見当たりません。`;
    }

    return {
      criterionId: criterion.id,
      title: criterion.title,
      maxPoints: criterion.points,
      earnedPoints: earnedPoints,
      status: status,
      feedback: feedback
    };
  }

  /**
   * 記述問題全体の採点メインロジック
   */
  gradeEssay(essayQuestion, userText) {
    const rawText = userText ? userText.trim() : "";
    const charCount = rawText.length;

    if (charCount === 0) {
      return {
        score: 0,
        grade: "unanswered",
        gradeLabel: "未入力",
        badgeClass: "badge-gray",
        keywordResults: [],
        prohibitedResult: null,
        criteriaResults: [],
        summaryAdvice: "解答が入力されていません。指定された語句を使って文章を作成してください。",
        modelAnswer: essayQuestion.modelAnswer,
        keyTakeaway: essayQuestion.keyTakeaway
      };
    }

    const normText = this.normalizeText(rawText);

    // 1. 必須キーワードチェック
    const keywordResults = [];
    let allRequiredFound = true;

    essayQuestion.requiredKeywords.forEach(kw => {
      const found = this.hasKeyword(normText, kw);
      keywordResults.push({
        keyword: kw,
        found: found
      });
      if (!found) {
        allRequiredFound = false;
      }
    });

    // 2. 禁止語句チェック（設定されている場合）
    let prohibitedResult = null;
    let prohibitedDeduction = 0;
    if (essayQuestion.prohibitedKeywords && essayQuestion.prohibitedKeywords.length > 0) {
      const probWord = essayQuestion.prohibitedKeywords[0];
      prohibitedResult = this.checkProhibitedKeywordContext(normText, probWord);
      if (prohibitedResult.used && !prohibitedResult.isContextAppropriate) {
        prohibitedDeduction = 25; // 誤った文脈で使用された場合は大幅減点
      }
    }

    // 3. 採点基準（必要条件・内容の適切性）の判定
    let totalCriteriaPoints = 0;
    const criteriaResults = essayQuestion.gradingCriteria.map(criterion => {
      const res = this.evaluateCriterion(normText, criterion);
      totalCriteriaPoints += res.earnedPoints;
      return res;
    });

    // 4. 文字数やキーワード欠落による調整
    let totalScore = totalCriteriaPoints;
    let adviceList = [];

    if (!allRequiredFound) {
      const missingKeywords = keywordResults.filter(k => !k.found).map(k => `「${k.keyword}」`);
      adviceList.push(`指定語句 ${missingKeywords.join("、")} が文中に含まれていません。必ずすべての指定語句を含めてください。`);
      // 必須語句が抜けている場合は上限70点
      totalScore = Math.min(totalScore, 70);
    }

    if (prohibitedDeduction > 0) {
      totalScore = Math.max(0, totalScore - prohibitedDeduction);
      adviceList.push(prohibitedResult.message);
    }

    if (charCount < 30) {
      totalScore = Math.min(totalScore, 40);
      adviceList.push("文章が短すぎます。背景や理由、具体的な物理の因果関係を詳しく記述してください。");
    }

    // 5. 判定グレード決定
    let grade = "fail";
    let gradeLabel = "不合格（要復習）";
    let badgeClass = "badge-danger";

    if (totalScore >= 85 && allRequiredFound && prohibitedDeduction === 0) {
      grade = "perfect";
      gradeLabel = "正解（満点合格）！素晴らしいです！";
      badgeClass = "badge-success";
      adviceList.unshift("必要な物理の論理関係と必須条件が過不足なく網羅されています。");
    } else if (totalScore >= 55) {
      grade = "partial";
      gradeLabel = "部分点獲得（あと一歩！）";
      badgeClass = "badge-warning";
      adviceList.unshift("重要なポイントは捉えられていますが、以下の条件を追加すると満点になります。");
    } else {
      grade = "fail";
      gradeLabel = "不合格（要復習）";
      badgeClass = "badge-danger";
      adviceList.unshift("設問の意図や物理法則の因果関係の説明が不足しています。模範解答を確認して復習しましょう。");
    }

    return {
      score: totalScore,
      charCount: charCount,
      grade: grade,
      gradeLabel: gradeLabel,
      badgeClass: badgeClass,
      keywordResults: keywordResults,
      prohibitedResult: prohibitedResult,
      criteriaResults: criteriaResults,
      summaryAdvice: adviceList.join("\n"),
      modelAnswer: essayQuestion.modelAnswer,
      keyTakeaway: essayQuestion.keyTakeaway
    };
  }

  /**
   * 穴埋め問題の採点ロジック
   */
  gradeFillIn(fillInQuestion, userSelections) {
    let correctCount = 0;
    const totalBlanks = fillInQuestion.blanks.length;
    const blankResults = [];

    fillInQuestion.blanks.forEach(blank => {
      const userChoice = userSelections[blank.index];
      const isCorrect = userChoice === blank.correctAnswer;
      if (isCorrect) correctCount++;

      blankResults.push({
        index: blank.index,
        label: blank.label,
        userChoice: userChoice || "未選択",
        correctAnswer: blank.correctAnswer,
        isCorrect: isCorrect,
        explanation: blank.explanation
      });
    });

    const isAllCorrect = correctCount === totalBlanks;
    const score = Math.round((correctCount / totalBlanks) * 100);

    return {
      score: score,
      correctCount: correctCount,
      totalCount: totalBlanks,
      isAllCorrect: isAllCorrect,
      gradeLabel: isAllCorrect ? "全問正解！" : `${totalBlanks}問中 ${correctCount}問正解`,
      badgeClass: isAllCorrect ? "badge-success" : (correctCount > 0 ? "badge-warning" : "badge-danger"),
      blankResults: blankResults
    };
  }
}

// グローバル公開
window.PhysicsEssayGrader = PhysicsEssayGrader;
