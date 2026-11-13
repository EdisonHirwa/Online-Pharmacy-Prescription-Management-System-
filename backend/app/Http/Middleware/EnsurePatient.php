<?php

namespace App\Http\Middleware;

use App\Models\Patient;
use App\Services\AuditService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePatient
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()->role !== 'patient') {
            AuditService::record('unauthorized_access', 'patient', null, 'Attempt to access a patient endpoint.');
            abort(403, 'Patient access is required.');
        }
        if (! Patient::where('user_id', $request->user()->id)->exists()) {
            abort(403, 'Your patient profile has not been configured. Contact administration to link your account.');
        }

        return $next($request);
    }
}
