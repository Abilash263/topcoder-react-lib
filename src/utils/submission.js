/**
 * Various submissions functions.
 */
/* global CONFIG */
/* eslint-disable no-param-reassign */
import _ from 'lodash';

const { AV_SCAN_SCORER_REVIEW_TYPE_ID, PROVISIONAL_SCORING_COMPLETED_REVIEW_TYPE_ID } = CONFIG;

function removeDecimal(num) {
  const re = new RegExp('^-?\\d+');
  return num.toString().match(re)[0];
}

function toAcurateFixed(num, decimal) {
  const re = new RegExp(`^-?\\d+(?:.\\d{0,${(decimal)}})?`);
  return num.toString().match(re)[0];
}

function toFixed(num, decimal) {
  if (_.isNaN(parseFloat(num))) return num;
  num = parseFloat(num);

  const result = _.toFinite(toAcurateFixed(num, decimal));
  const integerResult = _.toFinite(removeDecimal(num));

  if (_.isInteger(result)) {
    return integerResult;
  }
  return result;
}

/**
 * Process each submission rank of MM challenge
 * @param submissions the array of submissions
 */
function processRanks(submissions) {
  let maxFinalScore = 0;
  submissions.sort((a, b) => {
    let pA = _.get(a, 'submissions[0]', { provisionalScore: 0 }).provisionalScore;
    let pB = _.get(b, 'submissions[0]', { provisionalScore: 0 }).provisionalScore;
    if (pA === '-') pA = 0;
    if (pB === '-') pB = 0;
    if (pA === pB) {
      const timeA = new Date(_.get(a, 'submissions[0].submissionTime'));
      const timeB = new Date(_.get(b, 'submissions[0].submissionTime'));
      return timeA - timeB;
    }
    return pB - pA;
  });
  _.each(submissions, (submission, i) => {
    submissions[i].provisionalRank = i + 1;
  });

  submissions.sort((a, b) => {
    let pA = _.get(a, 'submissions[0]', { finalScore: 0 }).finalScore;
    let pB = _.get(b, 'submissions[0]', { finalScore: 0 }).finalScore;
    if (pA === '-') pA = 0;
    if (pB === '-') pB = 0;
    if (pA > 0) maxFinalScore = pA;
    if (pB > 0) maxFinalScore = pB;
    if (pA === pB) {
      const timeA = new Date(_.get(a, 'submissions[0].submissionTime'));
      const timeB = new Date(_.get(b, 'submissions[0].submissionTime'));
      return timeA - timeB;
    }
    return pB - pA;
  });
  if (maxFinalScore > 0) {
    _.each(submissions, (submission, i) => {
      submissions[i].finalRank = i + 1;
    });
  }
  return { submissions, maxFinalScore };
}

/**
 * Get provisional score of submission
 * @param submission
 */
export function getProvisionalScore(submission) {
  const { submissions: subs } = submission;
  if (!subs || subs.length === 0) {
    return 0;
  }
  const { provisionalScore } = subs[0];
  if (!provisionalScore || provisionalScore < 0) {
    return 0;
  }
  return provisionalScore;
}

/**
 * Get final score of submission
 * @param submission
 */
export function getFinalScore(submission) {
  const { submissions: subs } = submission;
  if (!subs || subs.length === 0) {
    return 0;
  }
  const { finalScore } = subs[0];
  if (!finalScore || finalScore < 0) {
    return 0;
  }
  return finalScore;
}

/**
 * Process submissions of MM challenge
 * @param submissions the array of submissions
 * @param resources the challenge resources
 * @param registrants the challenge registrants
 */
export function processMMSubmissions(submissions) {
  const data = {};
  const result = [];

  _.each(submissions, (submission) => {
    const { memberId } = submission;
    if (!data[memberId]) {
      data[memberId] = [];
    }
    const validReviews = _.reject(submission.review, ['typeId', AV_SCAN_SCORER_REVIEW_TYPE_ID]);
    validReviews.sort((a, b) => {
      const dateA = new Date(a.created);
      const dateB = new Date(b.created);
      return dateB - dateA;
    });

    const provisionalScoringIsCompleted = _.some(
      submission.review,
      { typeId: PROVISIONAL_SCORING_COMPLETED_REVIEW_TYPE_ID },
    );

    const provisionalScore = toFixed(_.get(validReviews, '[0].score', '-'), 5);
    const finalScore = toFixed(_.get(submission, 'reviewSummation[0].aggregateScore', '-'), 5);

    data[memberId].push({
      submissionId: submission.id,
      submissionTime: submission.created,
      provisionalScore,
      finalScore,
      provisionalScoringIsCompleted,
      review: submission.review,
    });
  });

  _.each(data, (value, key) => {
    result.push({
      submissions: [...value.sort((a, b) => new Date(b.submissionTime)
        .getTime() - new Date(a.submissionTime).getTime())],
      memberId: key,
    });
  });

  const { submissions: finalSubmissions, maxFinalScore } = processRanks(result);
  finalSubmissions.sort((a, b) => {
    if (maxFinalScore === 0) {
      return a.provisionalRank - b.provisionalRank;
    }
    return a.finalRank - b.finalRank;
  });

  return finalSubmissions;
}

export default undefined;
