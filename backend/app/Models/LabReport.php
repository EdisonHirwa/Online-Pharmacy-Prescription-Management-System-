<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class LabReport extends Model
{
    use SoftDeletes;

    protected $table = 'lab_reports';

    protected $guarded = ['id'];

    protected $hidden = ['file_path'];

    public function labTest(): BelongsTo
    {
        return $this->belongsTo(LabTest::class, 'lab_test_id');
    }
}
