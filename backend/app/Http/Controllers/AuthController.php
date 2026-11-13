<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Models\LoginAttempt;
use App\Models\Patient;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);
        $data = $request->validate([
            'name' => 'required|string|min:3|max:255', 'email' => 'required|email|unique:users,email', 'phone_number' => ['required', 'regex:/^\\+?[0-9]{9,15}$/', 'unique:users,phone_number'],
            'password' => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()->symbols()],
            'date_of_birth' => 'required|date_format:Y-m-d|before_or_equal:today', 'gender' => 'required|in:Male,Female,Other', 'blood_group' => 'nullable|in:A+,A-,B+,B-,AB+,AB-,O+,O-',
            'address' => 'required|string|max:5000', 'emergency_contact_name' => 'required|string|max:255', 'emergency_contact_phone' => ['required', 'regex:/^\\+?[0-9]{9,15}$/'],
        ]);
        $user = DB::transaction(function () use ($data): User {
            $user = User::create(collect($data)->only(['name', 'email', 'phone_number', 'password'])->all() + ['role' => 'patient', 'account_status' => 'active']);
            Patient::create(collect($data)->only(['date_of_birth', 'gender', 'blood_group', 'address', 'emergency_contact_name', 'emergency_contact_phone'])->all() + ['user_id' => $user->id, 'patient_number' => 'PAT-'.Str::ulid()]);
            AuditService::record('registered', 'users', $user->id, null, $user->id);

            return $user;
        });

        return response()->json(['user' => $user, 'token' => $user->createToken('hospital-portal', ['*'], now()->addHours(8))->plainTextToken], 201);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => 'required|email']);
        \Illuminate\Support\Facades\Password::sendResetLink(['email' => strtolower(trim($request->input('email'))), 'account_status' => 'active']);

        return response()->json(['message' => 'If an active account matches that email, password recovery instructions have been sent.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['token' => 'required|string', 'email' => 'required|email', 'password' => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()->symbols()]]);
        $status = \Illuminate\Support\Facades\Password::reset($data, function (User $user, string $password): void {
            DB::transaction(function () use ($user, $password): void {
                $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
                $user->tokens()->delete();
                AuditService::record('password_reset', 'users', $user->id, null, $user->id);
            });
        });
        if ($status !== \Illuminate\Support\Facades\Password::PasswordReset) {
            return response()->json(['message' => __($status)], 422);
        }

        return response()->json(['message' => 'Password reset. Sign in with your new password.']);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $key = 'login:'.hash('sha256', $request->input('email').'|'.$request->ip());
        $user = User::where('email', $request->input('email'))->first();
        $attempt = ['user_id' => $user?->id, 'email' => $request->input('email'), 'ip_address' => $request->ip(), 'attempt_date' => now()];
        if (RateLimiter::tooManyAttempts($key, 5)) {
            LoginAttempt::create($attempt + ['attempt_status' => 'suspicious_lockout']);

            return response()->json(['message' => 'Too many login attempts. Try again later.', 'retry_after' => RateLimiter::availableIn($key)], 429);
        }
        if (! $user || ! Hash::check($request->input('password'), $user->password) || $user->account_status !== 'active') {
            RateLimiter::hit($key, 300);
            LoginAttempt::create($attempt + ['attempt_status' => 'failed']);

            return response()->json(['message' => 'The credentials are incorrect or the account is inactive.'], 422);
        }
        RateLimiter::clear($key);
        LoginAttempt::create($attempt + ['attempt_status' => 'success']);
        AuditService::record('login', 'users', $user->id, null, $user->id);

        return response()->json(['user' => $user, 'token' => $user->createToken('hospital-portal', ['*'], now()->addHours(8))->plainTextToken]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()]);
    }

    public function logout(Request $request): JsonResponse
    {
        AuditService::record('logout', 'users', $request->user()->id);
        $token = $request->user()->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return response()->json(['message' => 'Signed out successfully.']);
    }

    public function profile(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate(['name' => 'required|string|max:255', 'email' => ['required', 'email', Rule::unique('users')->ignore($user->id)], 'phone_number' => ['required', 'regex:/^\+?[0-9]{9,15}$/', Rule::unique('users')->ignore($user->id)], 'current_password' => 'required_with:password|current_password:sanctum', 'password' => ['nullable', 'confirmed', Password::min(8)->mixedCase()->numbers()->symbols()]]);
        unset($data['current_password']);
        if (empty($data['password'])) {
            unset($data['password']);
        }
        DB::transaction(function () use ($user, $data): void {
            $user->update($data);
            if (isset($data['password'])) {
                $user->tokens()->where('id', '!=', $user->currentAccessToken()?->id)->delete();
            }
            AuditService::record('profile_updated', 'users', $user->id);
        });

        return response()->json(['data' => $user->fresh(), 'message' => 'Profile updated.']);
    }
}
