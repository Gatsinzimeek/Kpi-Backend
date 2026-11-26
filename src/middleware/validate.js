import { AppError } from '../utils/AppError.js';

// validate({ body, query, params }) -> parsed values on req.valid.{body,query,params}
export const validate = (schemas) => (req, _res, next) => {
  req.valid = {};
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) {
      const fields = {};
      for (const i of result.error.issues) fields[i.path.join('.') || '_'] ??= i.message;
      throw new AppError(422, Object.values(fields)[0] || 'Validation failed', fields);
    }
    req.valid[key] = result.data;
  }
  next();
};
