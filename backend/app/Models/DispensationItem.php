<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DispensationItem extends Model
{
    protected $guarded = ['id'];

    public function prescriptionItem(): BelongsTo
    {
        return $this->belongsTo(PrescriptionItem::class);
    }

    protected function casts(): array
    {
        return ['unit_price' => 'decimal:2', 'quantity_dispensed' => 'integer'];
    }
}
