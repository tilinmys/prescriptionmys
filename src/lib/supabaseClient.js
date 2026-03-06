import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function createFallbackQueryBuilder() {
  const state = {
    mutation: null,
    hasSelectAfterMutation: false,
    isSingle: false,
    isMaybeSingle: false,
  };

  function getMockResult() {
    if (state.mutation === 'insert' && state.hasSelectAfterMutation) {
      const generatedId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `local-${Date.now()}`;
      const row = { id: generatedId };
      return {
        data: state.isSingle || state.isMaybeSingle ? row : [row],
        error: null,
      };
    }

    if (state.isSingle || state.isMaybeSingle) {
      return { data: null, error: null };
    }

    return { data: [], error: null };
  }

  const builder = {
    select() {
      if (state.mutation) state.hasSelectAfterMutation = true;
      return builder;
    },
    insert() {
      state.mutation = 'insert';
      return builder;
    },
    update() {
      state.mutation = 'update';
      return builder;
    },
    delete() {
      state.mutation = 'delete';
      return builder;
    },
    upsert() {
      state.mutation = 'upsert';
      return builder;
    },
    eq() {
      return builder;
    },
    in() {
      return builder;
    },
    ilike() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    maybeSingle() {
      state.isMaybeSingle = true;
      return builder;
    },
    single() {
      state.isSingle = true;
      return builder;
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve(getMockResult()).then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return Promise.resolve(getMockResult()).catch(onRejected);
    },
  };

  return builder;
}

function createFallbackClient() {
  return {
    from() {
      return createFallbackQueryBuilder();
    },
    storage: {
      from() {
        return {
          async createSignedUrl() {
            return { data: null, error: null };
          },
          async upload() {
            return { data: { path: '' }, error: null };
          },
        };
      },
    },
  };
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createFallbackClient();
