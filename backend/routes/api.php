<?php

use App\Http\Controllers\Admin\AnalyticsController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\ResourceController;
use App\Http\Controllers\Admin\WorkflowController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\Doctor\DoctorController;
use App\Http\Middleware\ApplyHospitalSettings;
use Illuminate\Support\Facades\Route;

Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:public-auth');
Route::post('auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:public-auth');
Route::post('auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:public-auth');
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:30,1');
Route::middleware(['auth:sanctum', 'active', ApplyHospitalSettings::class])->group(function (): void {
    Route::get('configuration', fn () => response()->json(['data' => config('hospital', [])]));
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::get('user', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::put('auth/profile', [AuthController::class, 'profile']);
    Route::get('notifications', [WorkflowController::class, 'notifications']);
    Route::post('notifications/read', [WorkflowController::class, 'readNotifications']);
    Route::prefix('doctor')->middleware('doctor')->group(function (): void {
        $controller = DoctorController::class;
        Route::get('profile', [$controller, 'profile']);
        Route::put('profile', [$controller, 'updateProfile']);
        Route::get('dashboard', [$controller, 'dashboard']);
        Route::get('options', [$controller, 'options']);
        Route::post('schedules', [$controller, 'saveSchedule']);
        Route::put('schedules/{id}', [$controller, 'saveSchedule'])->whereNumber('id');
        Route::delete('schedules/{id}', [$controller, 'deleteSchedule'])->whereNumber('id');
        Route::post('consultations', [$controller, 'consultation']);
        Route::post('prescriptions', [$controller, 'prescription']);
        Route::put('prescriptions/{id}', [$controller, 'prescription'])->whereNumber('id');
        Route::post('prescriptions/{id}/cancel', [$controller, 'cancelPrescription'])->whereNumber('id');
        Route::get('prescriptions/{id}/download', [$controller, 'prescriptionPdf'])->whereNumber('id');
        Route::post('lab-requests', [$controller, 'laboratory']);
        Route::post('lab-requests/{id}/cancel', [$controller, 'cancelLab'])->whereNumber('id');
        Route::get('lab-reports/{id}/download', [$controller, 'downloadReport'])->whereNumber('id');
        Route::post('appointments/{id}/status', [$controller, 'appointmentStatus'])->whereNumber('id');
        Route::post('patients/{id}/{kind}', [$controller, 'patientNote'])->whereNumber('id')->whereIn('kind', ['allergies', 'medical-history']);
        Route::get('{resource}', [$controller, 'index']);
        Route::get('{resource}/{id}', [$controller, 'show'])->whereNumber('id');
    });
    Route::middleware('admin')->group(function (): void {
        Route::get('dashboard/stats', DashboardController::class);
        Route::prefix('admin')->group(function (): void {
            Route::get('analytics/{report}', [AnalyticsController::class, 'index']);
            Route::get('catalog', [ResourceController::class, 'catalog']);
            Route::get('options', [ResourceController::class, 'options']);
            Route::post('admissions', [WorkflowController::class, 'admit']);
            Route::post('admissions/{id}/discharge', [WorkflowController::class, 'discharge'])->whereNumber('id');
            Route::post('invoices', [WorkflowController::class, 'invoice']);
            Route::post('invoices/{id}/payments', [WorkflowController::class, 'payment'])->whereNumber('id');
            Route::post('invoices/{id}/cancel', [WorkflowController::class, 'cancelInvoice'])->whereNumber('id');
            Route::post('medicines/{id}/stock', [WorkflowController::class, 'stock'])->whereNumber('id');
            Route::post('appointments', [WorkflowController::class, 'appointment']);
            Route::post('appointments/{id}/reschedule', [WorkflowController::class, 'appointment'])->whereNumber('id');
            Route::post('appointments/{id}/status', [WorkflowController::class, 'appointmentStatus'])->whereNumber('id');
            Route::get('lab-reports/{id}/download', [WorkflowController::class, 'downloadReport'])->whereNumber('id');
            Route::get('reports/{resource}', [ReportController::class, 'export']);
            Route::get('{resource}', [ResourceController::class, 'index']);
            Route::get('{resource}/{id}', [ResourceController::class, 'show'])->whereNumber('id');
            Route::post('{resource}', [ResourceController::class, 'store']);
            Route::put('{resource}/{id}', [ResourceController::class, 'update'])->whereNumber('id');
            Route::delete('{resource}/{id}', [ResourceController::class, 'destroy'])->whereNumber('id');
        });
    });
});
