# 🧠 Learning Algorithm
## Adaptive User Feedback Pattern Recognition System

### **Algorithm Overview**

The Learning Algorithm continuously adapts the email intelligence system based on user interactions, creating personalized scoring patterns that improve accuracy over time. This system learns from every user action to build increasingly sophisticated email processing rules.

```pseudocode
FUNCTION processUserFeedback(userId, action, context):
    // Record the user action
    feedback = {
        user_id: userId,
        action: action,
        context: context,
        timestamp: now()
    }

    // Extract learning signals
    learningSignals = extractLearningSignals(feedback)

    // Update user patterns
    FOR EACH signal IN learningSignals:
        updateOrCreatePattern(userId, signal)

    // Refresh scoring algorithms
    refreshUserScoringWeights(userId)

    // Validate pattern effectiveness
    validatePatternAccuracy(userId, signal.pattern)

    RETURN {
        patterns_updated: learningSignals.length,
        scoring_adjustment: calculateScoringImpact(learningSignals),
        confidence_improvement: estimateConfidenceGain(learningSignals)
    }
END
```

---

## **Learning Signal Extraction**

```pseudocode
FUNCTION extractLearningSignals(feedback):
    signals = []

    SWITCH feedback.action.type:
        CASE "email_categorized":
            signals.extend(extractCategorizationSignals(feedback))
        CASE "vip_sender_added":
            signals.extend(extractVIPSignals(feedback))
        CASE "email_ignored":
            signals.extend(extractIgnoreSignals(feedback))
        CASE "unsubscribed":
            signals.extend(extractUnsubscribeSignals(feedback))
        CASE "marked_important":
            signals.extend(extractImportanceSignals(feedback))
        CASE "digest_action":
            signals.extend(extractDigestActionSignals(feedback))
        CASE "score_correction":
            signals.extend(extractScoreCorrectionSignals(feedback))

    RETURN deduplicateSignals(signals)
END
```

### **Categorization Learning**

```pseudocode
FUNCTION extractCategorizationSignals(feedback):
    signals = []
    email = feedback.context.email
    userCategory = feedback.action.category  // now/next/later/archive
    aiCategory = feedback.context.ai_suggested_category
    score = feedback.context.score

    // Learn from category corrections
    IF userCategory != aiCategory:
        // User disagreed with AI - strong learning signal
        signal = {
            pattern_type: "categorization_correction",
            trigger: {
                sender: email.sender,
                subject_keywords: extractKeywords(email.subject),
                content_patterns: extractContentPatterns(email.snippet)
            },
            adjustment: {
                category: userCategory,
                confidence_boost: 0.8,
                score_impact: calculateCategoryScoreImpact(userCategory, aiCategory)
            },
            weight: 1.0  // High weight for explicit corrections
        }
        signals.append(signal)

    // Learn sender-category associations
    IF userCategory IN ["now", "next"]:  // Important categories
        signal = {
            pattern_type: "sender",
            pattern_value: extractDomain(email.sender),
            score_impact: 15,  // Boost similar emails
            confidence_score: 0.7,
            learned_from_user_action: true
        }
        signals.append(signal)

    // Learn subject patterns
    subjectKeywords = extractImportantKeywords(email.subject)
    FOR EACH keyword IN subjectKeywords:
        IF keyword.importance > 0.6:
            impact = 10 if userCategory IN ["now", "next"] else -5
            signal = {
                pattern_type: "subject",
                pattern_value: keyword.text.toLowerCase(),
                score_impact: impact,
                confidence_score: keyword.importance * 0.8
            }
            signals.append(signal)

    RETURN signals
END
```

### **VIP Sender Learning**

```pseudocode
FUNCTION extractVIPSignals(feedback):
    signals = []
    sender = feedback.context.sender
    boost = feedback.action.score_boost

    // Direct VIP pattern
    signal = {
        pattern_type: "sender",
        pattern_value: sender,
        score_impact: boost,
        confidence_score: 1.0,  // User explicitly marked as VIP
        learned_from_user_action: true,
        vip_status: true
    }
    signals.append(signal)

    // Learn domain patterns for similar senders
    domain = extractDomain(sender)
    signal = {
        pattern_type: "domain",
        pattern_value: domain,
        score_impact: min(boost * 0.5, 25),  // Moderate boost for same domain
        confidence_score: 0.6
    }
    signals.append(signal)

    // Learn from sender name patterns (if available)
    senderName = feedback.context.sender_name
    IF senderName:
        namePatterns = extractNamePatterns(senderName)
        FOR EACH pattern IN namePatterns:
            signal = {
                pattern_type: "sender_name",
                pattern_value: pattern,
                score_impact: 10,
                confidence_score: 0.5
            }
            signals.append(signal)

    RETURN signals
END
```

### **Ignore Pattern Learning**

```pseudocode
FUNCTION extractIgnoreSignals(feedback):
    signals = []
    email = feedback.context.email
    timesIgnored = feedback.context.ignore_count

    // Sender ignore patterns
    IF timesIgnored >= 3:  // Consistently ignored
        signal = {
            pattern_type: "sender",
            pattern_value: email.sender,
            score_impact: -20,  // Significant penalty
            confidence_score: 0.8,
            learned_from_user_action: true
        }
        signals.append(signal)

    // Subject ignore patterns
    IF timesIgnored >= 2:
        subjectKeywords = extractKeywords(email.subject)
        FOR EACH keyword IN subjectKeywords:
            IF keyword.frequency > 0.3:  // Common in ignored emails
                signal = {
                    pattern_type: "subject",
                    pattern_value: keyword.text.toLowerCase(),
                    score_impact: -8,
                    confidence_score: keyword.frequency * 0.6
                }
                signals.append(signal)

    // Category ignore patterns
    emailCategory = classifyEmailContent(email)
    signal = {
        pattern_type: "content_category",
        pattern_value: emailCategory,
        score_impact: -12,
        confidence_score: 0.5
    }
    signals.append(signal)

    RETURN signals
END
```

### **Unsubscribe Learning**

```pseudocode
FUNCTION extractUnsubscribeSignals(feedback):
    signals = []
    sender = feedback.context.sender
    reason = feedback.action.reason  // "too_frequent", "not_relevant", "promotional"

    // Strong negative signal for unsubscribed senders
    signal = {
        pattern_type: "sender",
        pattern_value: sender,
        score_impact: -30,  // Maximum penalty
        confidence_score: 1.0,
        learned_from_user_action: true,
        unsubscribed: true
    }
    signals.append(signal)

    // Learn domain patterns
    domain = extractDomain(sender)
    domainImpact = calculateDomainImpact(domain, reason)
    signal = {
        pattern_type: "domain",
        pattern_value: domain,
        score_impact: domainImpact,
        confidence_score: 0.7
    }
    signals.append(signal)

    // Learn reason-specific patterns
    SWITCH reason:
        CASE "too_frequent":
            // Learn to penalize high-frequency senders
            signal = {
                pattern_type: "frequency_penalty",
                pattern_value: domain,
                score_impact: -15,
                confidence_score: 0.8
            }

        CASE "promotional":
            // Strengthen promotional detection
            contentKeywords = feedback.context.promotional_keywords
            FOR EACH keyword IN contentKeywords:
                signal = {
                    pattern_type: "content",
                    pattern_value: keyword,
                    score_impact: -10,
                    confidence_score: 0.7
                }
                signals.append(signal)

    RETURN signals
END
```

---

## **Pattern Management and Updates**

```pseudocode
FUNCTION updateOrCreatePattern(userId, learningSignal):
    existingPattern = findPattern(userId, learningSignal.pattern_type, learningSignal.pattern_value)

    IF existingPattern:
        updatedPattern = updateExistingPattern(existingPattern, learningSignal)
    ELSE:
        updatedPattern = createNewPattern(userId, learningSignal)

    storePattern(updatedPattern)
    updatePatternEffectiveness(updatedPattern)

    RETURN updatedPattern
END

FUNCTION updateExistingPattern(existingPattern, learningSignal):
    // Weighted average with new signal
    oldWeight = existingPattern.sample_count
    newWeight = learningSignal.weight || 1.0
    totalWeight = oldWeight + newWeight

    // Update score impact using weighted average
    newScoreImpact = (
        (existingPattern.score_impact * oldWeight) +
        (learningSignal.score_impact * newWeight)
    ) / totalWeight

    // Update confidence using exponential moving average
    alpha = 0.3  // Learning rate
    newConfidence = (1 - alpha) * existingPattern.confidence_score +
                   alpha * learningSignal.confidence_score

    updatedPattern = {
        ...existingPattern,
        score_impact: clamp(newScoreImpact, -50, 50),
        confidence_score: clamp(newConfidence, 0.0, 1.0),
        sample_count: existingPattern.sample_count + 1,
        last_seen_at: now(),
        learned_from_user_action: existingPattern.learned_from_user_action || learningSignal.learned_from_user_action
    }

    RETURN updatedPattern
END
```

### **Pattern Effectiveness Validation**

```pseudocode
FUNCTION validatePatternAccuracy(userId, pattern):
    // Get recent emails that match this pattern
    recentMatches = findRecentMatchingEmails(userId, pattern, days=7)

    IF recentMatches.length < 3:
        RETURN  // Need more data for validation

    // Calculate accuracy metrics
    correctPredictions = 0
    totalPredictions = recentMatches.length

    FOR EACH email IN recentMatches:
        predictedScore = applyPattern(pattern, email.base_score)
        actualUserAction = getUserActionForEmail(email.id)

        IF isAccuratePrediction(predictedScore, actualUserAction):
            correctPredictions += 1

    accuracy = correctPredictions / totalPredictions

    // Update pattern confidence based on accuracy
    IF accuracy >= 0.8:
        increasePatternConfidence(pattern, 0.1)
    ELSE IF accuracy <= 0.4:
        decreasePatternConfidence(pattern, 0.2)

    // Archive ineffective patterns
    IF pattern.confidence_score < 0.3:
        archivePattern(pattern)

    recordPatternAccuracy(pattern.id, accuracy)
END
```

---

## **Adaptive Scoring Weight Adjustment**

```pseudocode
FUNCTION refreshUserScoringWeights(userId):
    userPatterns = getUserPatterns(userId)
    currentWeights = getUserScoringPreferences(userId)

    // Analyze pattern effectiveness by category
    categoryEffectiveness = analyzePatternEffectiveness(userPatterns)

    // Adjust weights based on what works for this user
    adjustedWeights = currentWeights

    IF categoryEffectiveness.sender_patterns > 0.8:
        adjustedWeights.vip_sender_weight = min(currentWeights.vip_sender_weight * 1.1, 2.0)

    IF categoryEffectiveness.urgency_patterns > 0.8:
        adjustedWeights.urgent_keywords_weight = min(currentWeights.urgent_keywords_weight * 1.1, 2.0)

    IF categoryEffectiveness.marketing_patterns > 0.9:
        adjustedWeights.marketing_penalty_weight = min(currentWeights.marketing_penalty_weight * 1.15, 2.0)

    // Save updated weights
    updateUserScoringPreferences(userId, adjustedWeights)

    RETURN adjustedWeights
END
```

### **Cross-User Pattern Learning**

```pseudocode
FUNCTION learnFromSimilarUsers(userId, newPattern):
    // Find users with similar email patterns
    similarUsers = findSimilarUsers(userId, similarity_threshold=0.7)

    IF similarUsers.length == 0:
        RETURN  // No similar users found

    // Aggregate patterns from similar users
    aggregatedPatterns = []
    FOR EACH similarUser IN similarUsers:
        userPatterns = getUserPatterns(similarUser.id)
        relevantPatterns = filterRelevantPatterns(userPatterns, newPattern)
        aggregatedPatterns.extend(relevantPatterns)

    // Extract insights for new pattern confidence
    IF aggregatedPatterns.length >= 3:
        avgImpact = average(pattern.score_impact for pattern in aggregatedPatterns)
        avgConfidence = average(pattern.confidence_score for pattern in aggregatedPatterns)

        // Boost confidence if similar users have similar patterns
        IF abs(newPattern.score_impact - avgImpact) < 10:
            newPattern.confidence_score = min(newPattern.confidence_score * 1.2, 1.0)
END
```

---

## **Real-time Learning Integration**

```pseudocode
FUNCTION integrateRealTimeFeedback(userId, emailId, userAction):
    email = getEmailById(emailId)
    currentScore = getEmailScore(emailId)

    // Create learning context
    context = {
        email: email,
        current_score: currentScore,
        processing_tier: currentScore.processing_tier,
        ai_analysis: getAIAnalysis(emailId),
        user_history: getUserActionHistory(userId, email.sender, limit=10)
    }

    // Process the feedback immediately
    feedback = {
        user_id: userId,
        action: userAction,
        context: context
    }

    learningResult = processUserFeedback(userId, userAction, context)

    // Apply learning to similar pending emails immediately
    pendingEmails = getPendingEmailsForUser(userId)
    FOR EACH pendingEmail IN pendingEmails:
        IF emailMatchesLearningPattern(pendingEmail, learningResult.patterns_updated):
            recalculatedScore = recalculateEmailScore(pendingEmail, userId)
            updateEmailScore(pendingEmail.id, recalculatedScore)

    RETURN learningResult
END
```

### **Batch Learning Optimization**

```pseudocode
FUNCTION processBatchLearning(userId, feedbackBatch):
    // Group feedback by pattern type for efficient processing
    groupedFeedback = groupFeedbackByType(feedbackBatch)

    allSignals = []
    FOR EACH feedbackType, feedbackList IN groupedFeedback:
        batchSignals = processFeedbackBatch(feedbackList)
        allSignals.extend(batchSignals)

    // Optimize pattern updates - batch similar patterns
    optimizedPatterns = optimizePatternsForBatch(allSignals)

    // Update all patterns in single database transaction
    updatePatternsInBatch(userId, optimizedPatterns)

    // Refresh scoring weights once after all updates
    refreshUserScoringWeights(userId)

    RETURN {
        patterns_processed: len(optimizedPatterns),
        feedback_items: len(feedbackBatch),
        processing_time: calculateProcessingTime()
    }
END
```

---

## **Learning Performance Metrics**

```pseudocode
FUNCTION calculateLearningMetrics(userId):
    timeWindow = 30  // days

    metrics = {
        pattern_count: countUserPatterns(userId),
        accuracy_improvement: calculateAccuracyImprovement(userId, timeWindow),
        learning_velocity: calculateLearningVelocity(userId, timeWindow),
        confidence_growth: calculateConfidenceGrowth(userId, timeWindow),
        scoring_effectiveness: calculateScoringEffectiveness(userId, timeWindow)
    }

    // Calculate scoring accuracy before and after learning
    beforeAccuracy = getHistoricalAccuracy(userId, timeWindow * 2, timeWindow)
    afterAccuracy = getRecentAccuracy(userId, timeWindow)

    metrics.accuracy_improvement = afterAccuracy - beforeAccuracy

    // Calculate learning velocity (patterns created per week)
    recentPatterns = getRecentPatterns(userId, timeWindow)
    metrics.learning_velocity = recentPatterns.length / (timeWindow / 7)

    RETURN metrics
END

FUNCTION generateLearningReport(userId):
    metrics = calculateLearningMetrics(userId)
    topPatterns = getTopPerformingPatterns(userId, limit=10)

    report = {
        summary: {
            total_patterns: metrics.pattern_count,
            accuracy_improvement: f"{metrics.accuracy_improvement:.1%}",
            weekly_learning_rate: f"{metrics.learning_velocity:.1f} patterns/week"
        },
        insights: generateLearningInsights(metrics, topPatterns),
        recommendations: generateOptimizationRecommendations(metrics)
    }

    RETURN report
END
```

---

## **Memory-Efficient Pattern Storage**

```pseudocode
FUNCTION optimizePatternStorage(userId):
    allPatterns = getUserPatterns(userId)

    // Archive low-confidence patterns
    lowConfidencePatterns = filterPatterns(allPatterns, confidence < 0.3)
    FOR EACH pattern IN lowConfidencePatterns:
        IF pattern.last_seen_at < now() - 30 days:
            archivePattern(pattern)

    // Merge similar patterns to reduce storage
    similarPatterns = findSimilarPatterns(allPatterns)
    FOR EACH groupedPatterns IN similarPatterns:
        IF groupedPatterns.length > 1:
            mergedPattern = mergePatterns(groupedPatterns)
            replacePatternsWithMerged(groupedPatterns, mergedPattern)

    // Update materialized view
    refreshUserScoringPatterns(userId)
END
```

### **Success Metrics**

- ✅ **Accuracy Improvement**: 15%+ improvement in scoring accuracy over 30 days
- ✅ **Learning Speed**: New patterns created within 24 hours of user feedback
- ✅ **Pattern Confidence**: 85%+ confidence for user-validated patterns
- ✅ **Storage Efficiency**: <1MB pattern storage per user
- ✅ **Real-time Adaptation**: Pattern updates applied to pending emails within 5 seconds

The Learning Algorithm creates a continuously improving system that adapts to each user's unique email patterns and preferences, delivering increasingly personalized and accurate email intelligence over time.