<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::define('manage-hospital', fn (User $user): bool => $user->role === 'admin' && $user->account_status === 'active');
        RateLimiter::for('public-auth', fn (Request $request) => Limit::perMinute(5)->by($request->ip().'|'.$request->path()));
        ResetPassword::createUrlUsing(fn (object $user, string $token): string => rtrim(config('app.frontend_url'), '/').'/reset-password?token='.urlencode($token).'&email='.urlencode($user->email));
    }
}
