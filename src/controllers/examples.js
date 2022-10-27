import Example from '../models/Example';
import { packageResponse, handleQueries } from './utils';
import { searchExamplesRegexQuery } from './utils/queries';
import { REDIS_CACHE_EXPIRATION } from '../config';

/* Create a new Example object in MongoDB */
export const createExample = (data) => {
  const example = new Example(data);
  return example.save();
};

/* Uses regex to search for examples with both Igbo and English */
const searchExamples = async ({ query, skip, limit }) => {
  const allExamples = await Example.find(query);
  const examples = allExamples.slice(skip, skip + limit);
  const contentLength = allExamples.length;
  return { examples, contentLength };
};

/* Returns examples from MongoDB */
export const getExamples = (redisClient) => async (req, res, next) => {
  try {
    const {
      searchWord,
      regexKeyword,
      skip,
      limit,
      ...rest
    } = handleQueries(req);
    const regexMatch = searchExamplesRegexQuery(regexKeyword);
    const redisExamplesCacheKey = `example-${searchWord}-${skip}-${limit}`;
    const redisExamplesCountCacheKey = `example-${searchWord}`;
    const cachedExamples = await redisClient.get(redisExamplesCacheKey);
    const cachedExamplesCount = await redisClient.get(redisExamplesCountCacheKey);
    let examples;
    let contentLength;
    if (cachedExamples && cachedExamplesCount) {
      examples = cachedExamples;
      contentLength = cachedExamplesCount;
    } else {
      const allExamples = await searchExamples({ query: regexMatch, skip, limit });
      examples = allExamples.examples;
      contentLength = allExamples.contentLength;
      redisClient.set(redisExamplesCacheKey, JSON.stringify(allExamples.examples), 'EX', REDIS_CACHE_EXPIRATION);
      redisClient.set(
        redisExamplesCountCacheKey,
        JSON.stringify(allExamples.contentLength),
        'EX',
        REDIS_CACHE_EXPIRATION,
      );
    }

    return packageResponse({
      res,
      docs: examples,
      contentLength,
      ...rest,
    });
  } catch (err) {
    return next(err);
  }
};

export const findExampleById = (id) => (
  Example.findById(id)
);

/* Returns an example from MongoDB using an id */
export const getExample = async (req, res, next) => {
  try {
    const { id } = req.params;
    const foundExample = await findExampleById(id)
      .then((example) => {
        if (!example) {
          throw new Error('No example exists with the provided id.');
        }
        return example;
      });
    return res.send(foundExample);
  } catch (err) {
    return next(err);
  }
};
