<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HospitalBed extends Model
{
    protected $table = 'hospital_beds';

    protected $guarded = ['id'];

    public function ward(): BelongsTo
    {
        return $this->belongsTo(Ward::class);
    }
}
