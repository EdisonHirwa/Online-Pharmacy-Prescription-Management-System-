<?php

namespace App\Http\Middleware;

use App\Models\SystemSetting;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApplyHospitalSettings
{
    public function handle(Request $request, Closure $next): Response
    {
        $settings = SystemSetting::pluck('value', 'key')->all();
        config(['hospital' => $settings]);
        $timezone = $settings['timezone'] ?? config('app.timezone');
        config(['app.timezone' => $timezone]);
        date_default_timezone_set($timezone);

        return $next($request);
    }
}
