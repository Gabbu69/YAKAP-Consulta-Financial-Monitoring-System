<?php

namespace App\Http\Requests;

use App\Enums\ServiceClassification;
use App\Models\Service;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ServiceCatalogRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $routeService = $this->route('service');
        $serviceId = $routeService instanceof Service
            ? $routeService->getKey()
            : (is_numeric($routeService) ? (int) $routeService : null);

        return [
            'category_name' => ['required', 'string', 'max:120'],
            'classification' => ['required', Rule::enum(ServiceClassification::class)],
            'code' => ['required', 'string', 'max:50', Rule::unique('services', 'code')->ignore($serviceId)],
            'name' => ['required', 'string', 'max:180'],
            'unit' => ['required', 'string', 'max:40'],
            'default_cost_centavos' => ['required', 'integer', 'min:0', 'max:999999999'],
            'is_active' => ['required', 'boolean'],
        ];
    }
}
