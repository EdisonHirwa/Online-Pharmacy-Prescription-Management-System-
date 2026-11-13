<?php

namespace App\Http\Middleware;

use App\Models\Doctor;
use App\Services\AuditService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureDoctor
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()->role !== 'doctor') {
            AuditService::record('unauthorized_access', 'doctor', null, 'Attempt to access a doctor endpoint.');
            abort(403, 'Doctor access is required.');
        }
        if (! Doctor::where('user_id', $request->user()->id)->exists()) {
            abort(403, 'Your doctor profile has not been configured. Ask an administrator to link your account to a doctor profile.');
        }

        return $next($request);
    }
}
