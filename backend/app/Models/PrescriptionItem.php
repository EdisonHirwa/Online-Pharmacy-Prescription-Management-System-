<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrescriptionItem extends Model
{
    protected $table = 'prescription_items';

    protected $guarded = ['id'];

    public function medicine(): BelongsTo
    {
        return $this->belongsTo(Medicine::class);
    }
}
