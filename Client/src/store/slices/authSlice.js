import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../lib/api";

const storageKey = "rentalhub_auth";

const loadPersisted = () => {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const persist = (state) => {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        user: state.user,
        token: state.token,
      })
    );
  } catch {
    // ignore storage failures
  }
};

const persisted = loadPersisted();

export const register = createAsyncThunk(
  "auth/register",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.post("/users/register", payload);
      const body = res.data;
      return {
        user: body?.data?.user ?? null,
        token: body?.token ?? null,
      };
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || err.message || "Registration failed"
      );
    }
  }
);

export const login = createAsyncThunk(
  "auth/login",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.post("/users/login", payload);
      const body = res.data;
      return {
        user: body?.data?.user ?? null,
        token: body?.token ?? null,
      };
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || err.message || "Login failed"
      );
    }
  }
);

export const logout = createAsyncThunk(
  "auth/logout",
  async (_, { rejectWithValue }) => {
    try {
      await api.post("/users/logout");
      return true;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || err.message || "Logout failed"
      );
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  "auth/fetchCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/users/me");
      const body = res.data;
      return {
        user: body?.data?.user ?? null,
      };
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || err.message || "Failed to load user"
      );
    }
  }
);

export const updateProfile = createAsyncThunk(
  "auth/updateProfile",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.patch("/users/me", payload);
      const body = res.data;
      return {
        user: body?.data?.user ?? null,
      };
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || err.message || "Profile update failed"
      );
    }
  }
);

export const updateOwnerProfile = createAsyncThunk(
  "auth/updateOwnerProfile",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.patch("/users/me/owner-profile", payload);
      const body = res.data;
      return {
        user: body?.data?.user ?? null,
      };
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || err.message || "Owner profile update failed"
      );
    }
  }
);

export const updatePassword = createAsyncThunk(
  "auth/updatePassword",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.patch("/users/me/password", payload);
      const body = res.data;
      return {
        user: body?.data?.user ?? null,
        token: body?.token ?? null,
      };
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || err.message || "Password update failed"
      );
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: persisted?.user || null,
    token: persisted?.token || null,
    status: "idle",
    error: null,
  },
  reducers: {
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const setPending = (state) => {
      state.status = "loading";
      state.error = null;
    };
    const setRejected = (state, action) => {
      state.status = "failed";
      state.error = action.payload || "Something went wrong";
    };

    builder
      .addCase(register.pending, setPending)
      .addCase(register.rejected, setRejected)
      .addCase(register.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload?.user || null;
        state.token = action.payload?.token || null;
        persist(state);
      })
      .addCase(login.pending, setPending)
      .addCase(login.rejected, setRejected)
      .addCase(login.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload?.user || null;
        state.token = action.payload?.token || null;
        persist(state);
      })
      .addCase(logout.pending, setPending)
      .addCase(logout.rejected, setRejected)
      .addCase(logout.fulfilled, (state) => {
        state.status = "succeeded";
        state.user = null;
        state.token = null;
        state.error = null;
        try {
          localStorage.removeItem(storageKey);
        } catch {
          // ignore
        }
      })
      .addCase(fetchCurrentUser.pending, setPending)
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.status = "failed";
        state.user = null;
        state.token = null;
        state.error = action.payload || "Failed to load user";
        try {
          localStorage.removeItem(storageKey);
        } catch {
          // ignore
        }
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload?.user || null;
        persist(state);
      })
      .addCase(updateProfile.pending, setPending)
      .addCase(updateProfile.rejected, setRejected)
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload?.user || null;
        persist(state);
      })
      .addCase(updateOwnerProfile.pending, setPending)
      .addCase(updateOwnerProfile.rejected, setRejected)
      .addCase(updateOwnerProfile.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload?.user || null;
        persist(state);
      })
      .addCase(updatePassword.pending, setPending)
      .addCase(updatePassword.rejected, setRejected)
      .addCase(updatePassword.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload?.user || null;
        state.token = action.payload?.token || state.token;
        persist(state);
      });
  },
});

export const { clearAuthError } = authSlice.actions;
export default authSlice.reducer;

