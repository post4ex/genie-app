/**
 * docs-validation.js
 * Centralized validation scheme for all document fields
 * Allows easy editing of field requirements and validation rules
 */

// ============================================================================
// VALIDATION SCHEME - EASY TO EDIT
// ============================================================================
const VALIDATION_SCHEME = {
    // --- COMMON FIELDS (used across multiple documents) ---
    'reference_id': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Reference ID must be 50 characters or less'
    },
    'invoice_no': {
        required: true,
        type: 'text',
        minLength: 1,
        maxLength: 30,
        pattern: /^[A-Z0-9\-\/]+$/,
        errorMessage: 'Invoice number is required and must contain only letters, numbers, hyphens, and slashes'
    },
    'invoice_date': {
        required: true,
        type: 'date',
        minDate: '2020-01-01',
        maxDate: null, // null = no limit
        errorMessage: 'Invoice date is required and must be after 2020'
    },
    'exporter_details': {
        required: true,
        type: 'textarea',
        minLength: 10,
        maxLength: 500,
        pattern: null,
        errorMessage: 'Exporter details are required (minimum 10 characters)'
    },
    'consignee_details': {
        required: true,
        type: 'textarea',
        minLength: 10,
        maxLength: 500,
        pattern: null,
        errorMessage: 'Consignee details are required (minimum 10 characters)'
    },
    'country_dest': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Z\s]+$/,
        errorMessage: 'Destination country is required (uppercase letters only)'
    },
    'place_supply': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Place of supply must be 2-50 characters'
    },
    'gstin': {
        required: false,
        type: 'text',
        minLength: 15,
        maxLength: 15,
        pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        errorMessage: 'GSTIN must be exactly 15 characters in valid format'
    },
    'description_of_goods': {
        required: true,
        type: 'textarea',
        minLength: 5,
        maxLength: 1000,
        pattern: null,
        errorMessage: 'Description of goods is required (minimum 5 characters)'
    },
    'awb_number': {
        required: true,
        type: 'text',
        minLength: 8,
        maxLength: 20,
        pattern: /^[A-Z0-9\-]+$/,
        errorMessage: 'AWB number is required (8-20 characters, letters/numbers/hyphens only)'
    },

    // --- SPECIFIC DOCUMENT FIELDS ---
    
    // KYC Fields
    'entity_type': {
        required: true,
        type: 'select',
        options: ['Individual/Proprietary firm', 'Company', 'Trusts/Foundations', 'Partnership firm'],
        errorMessage: 'Entity type selection is required'
    },
    'entity_name': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Entity name is required (2-100 characters)'
    },
    'permanent_address': {
        required: true,
        type: 'textarea',
        minLength: 10,
        maxLength: 300,
        pattern: null,
        errorMessage: 'Permanent address is required (minimum 10 characters)'
    },
    'business_address': {
        required: true,
        type: 'textarea',
        minLength: 10,
        maxLength: 300,
        pattern: null,
        errorMessage: 'Business address is required (minimum 10 characters)'
    },
    'auth_signatories': {
        required: true,
        type: 'textarea',
        minLength: 5,
        maxLength: 200,
        pattern: null,
        errorMessage: 'Authorized signatories are required (minimum 5 characters)'
    },
    'iec_no': {
        required: true,
        type: 'text',
        minLength: 10,
        maxLength: 10,
        pattern: /^[0-9]{10}$/,
        errorMessage: 'IEC number must be exactly 10 digits'
    },
    'pan': {
        required: true,
        type: 'text',
        minLength: 10,
        maxLength: 10,
        pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
        errorMessage: 'PAN must be in format AAAAA9999A'
    },
    'declaration_text': {
        required: true,
        type: 'textarea',
        minLength: 50,
        maxLength: 2000,
        pattern: null,
        errorMessage: 'Declaration text is required'
    },
    'authorized_signatory_name': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Za-z\s\.\-\']+$/,
        errorMessage: 'Signatory name is required (letters, spaces, dots, hyphens, apostrophes only)'
    },
    'authorized_signatory_designation': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Signatory designation is required'
    },
    'declaration_place': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Za-z\s]+$/,
        errorMessage: 'Declaration place is required (letters and spaces only)'
    },
    'declaration_date': {
        required: true,
        type: 'date',
        minDate: '2020-01-01',
        maxDate: null,
        errorMessage: 'Declaration date is required'
    },

    // Commercial Invoice Fields
    'iec': {
        required: false,
        type: 'text',
        minLength: 10,
        maxLength: 10,
        pattern: /^[0-9]{10}$/,
        errorMessage: 'IEC code must be exactly 10 digits'
    },
    'exporter_ref': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Exporter reference must be 50 characters or less'
    },
    'other_ref': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Other references must be 50 characters or less'
    },
    'buyer_order': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 30,
        pattern: null,
        errorMessage: 'Buyer order number must be 30 characters or less'
    },
    'buyer_date': {
        required: false,
        type: 'date',
        minDate: '2020-01-01',
        maxDate: null,
        errorMessage: 'Order date must be after 2020'
    },
    'buyer_details': {
        required: false,
        type: 'textarea',
        minLength: 0,
        maxLength: 500,
        pattern: null,
        errorMessage: 'Buyer details must be 500 characters or less'
    },
    'country_origin': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Z\s]+$/,
        errorMessage: 'Country of origin must be uppercase letters only'
    },
    'pre_carriage': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Pre-carriage must be 50 characters or less'
    },
    'place_receipt': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Place of receipt must be 50 characters or less'
    },
    'vessel_flight_no': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 30,
        pattern: null,
        errorMessage: 'Vessel/flight number must be 30 characters or less'
    },
    'port_loading': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Port of loading must be 50 characters or less'
    },
    'port_discharge': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Port of discharge must be 50 characters or less'
    },
    'final_dest': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Final destination must be 50 characters or less'
    },
    'terms': {
        required: false,
        type: 'select',
        options: ['FOB', 'CIF', 'C&F', 'EXW', 'DAP', 'DDP'],
        errorMessage: 'Please select valid Incoterms'
    },
    'payment_terms': {
        required: false,
        type: 'select',
        options: ['DP', 'DA', 'AP', 'LC', 'TT'],
        errorMessage: 'Please select valid payment terms'
    },
    'currency': {
        required: false,
        type: 'select',
        options: ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'AED', 'INR', 'JPY', 'CHF', 'SGD'],
        errorMessage: 'Please select valid currency'
    },
    'exchange_rate': {
        required: false,
        type: 'number',
        min: 0.01,
        max: 1000,
        errorMessage: 'Exchange rate must be between 0.01 and 1000'
    },
    'declaration': {
        required: false,
        type: 'textarea',
        minLength: 0,
        maxLength: 500,
        pattern: null,
        errorMessage: 'Declaration must be 500 characters or less'
    },

    // Packing List Fields
    'vessel_flight': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 30,
        pattern: null,
        errorMessage: 'Vessel/flight must be 30 characters or less'
    },
    'marks_numbers': {
        required: false,
        type: 'textarea',
        minLength: 0,
        maxLength: 200,
        pattern: null,
        errorMessage: 'Marks & numbers must be 200 characters or less'
    },
    'special_instructions': {
        required: false,
        type: 'textarea',
        minLength: 0,
        maxLength: 300,
        pattern: null,
        errorMessage: 'Special instructions must be 300 characters or less'
    },

    // SLI Fields
    'shipper_name': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Shipper name is required (2-100 characters)'
    },
    'consignee_name': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Consignee name is required (2-100 characters)'
    },
    'sli_date': {
        required: true,
        type: 'date',
        minDate: '2020-01-01',
        maxDate: null,
        errorMessage: 'SLI date is required'
    },
    'e_code': {
        required: false,
        type: 'text',
        minLength: 10,
        maxLength: 10,
        pattern: /^[0-9]{10}$/,
        errorMessage: 'E-code must be exactly 10 digits'
    },
    'bank_ad_code': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 20,
        pattern: null,
        errorMessage: 'Bank AD code must be 20 characters or less'
    },
    'incoterms': {
        required: false,
        type: 'select',
        options: ['FOB', 'C&F', 'C&I', 'CIF'],
        errorMessage: 'Please select valid Incoterms'
    },
    'invoice_value': {
        required: false,
        type: 'number',
        min: 0,
        max: 999999999,
        errorMessage: 'Invoice value must be a positive number'
    },
    'freight': {
        required: false,
        type: 'number',
        min: 0,
        max: 999999999,
        errorMessage: 'Freight must be a positive number'
    },
    'insurance': {
        required: false,
        type: 'number',
        min: 0,
        max: 999999999,
        errorMessage: 'Insurance must be a positive number'
    },
    'commission': {
        required: false,
        type: 'number',
        min: 0,
        max: 999999999,
        errorMessage: 'Commission must be a positive number'
    },
    'discount': {
        required: false,
        type: 'number',
        min: 0,
        max: 999999999,
        errorMessage: 'Discount must be a positive number'
    },
    'no_of_pkgs': {
        required: false,
        type: 'number',
        min: 1,
        max: 99999,
        errorMessage: 'Number of packages must be a positive number'
    },
    'net_weight': {
        required: false,
        type: 'number',
        min: 0,
        max: 999999,
        errorMessage: 'Net weight must be a positive number'
    },
    'gross_weight': {
        required: false,
        type: 'number',
        min: 0,
        max: 999999,
        errorMessage: 'Gross weight must be a positive number'
    },
    'volume_weight': {
        required: false,
        type: 'number',
        min: 0,
        max: 999999,
        errorMessage: 'Volume weight must be a positive number'
    },
    'forwarder_name': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Freight forwarder name is required (2-100 characters)'
    },

    // BL/AWB Fields
    'carrier_name': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Carrier name is required (2-100 characters)'
    },
    'port_of_loading': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Port of loading must be 50 characters or less'
    },
    'port_of_discharge': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Port of discharge must be 50 characters or less'
    },

    // Insurance Certificate Fields
    'policy_no': {
        required: true,
        type: 'text',
        minLength: 5,
        maxLength: 30,
        pattern: null,
        errorMessage: 'Policy number is required (5-30 characters)'
    },
    'insured_amount': {
        required: true,
        type: 'number',
        min: 1,
        max: 999999999,
        errorMessage: 'Insured amount is required and must be positive'
    },
    'insured_party': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Insured party must be 100 characters or less'
    },
    'subject_matter': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 200,
        pattern: null,
        errorMessage: 'Subject matter must be 200 characters or less'
    },

    // SDF Fields
    'shipping_bill_no': {
        required: true,
        type: 'text',
        minLength: 5,
        maxLength: 20,
        pattern: /^[A-Z0-9\-\/]+$/,
        errorMessage: 'Shipping bill number is required (letters, numbers, hyphens, slashes only)'
    },
    'shipping_bill_date': {
        required: true,
        type: 'date',
        minDate: '2020-01-01',
        maxDate: null,
        errorMessage: 'Shipping bill date is required'
    },
    'seller_consignor': {
        required: false,
        type: 'select',
        options: ['SELLER', 'CONSIGNOR'],
        errorMessage: 'Please select declaration type'
    },
    'value_ascertainment': {
        required: false,
        type: 'select',
        options: ['A - Value as contracted', 'B - Value not ascertainable'],
        errorMessage: 'Please select value ascertainment type'
    },
    'bank_name': {
        required: true,
        type: 'text',
        minLength: 5,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Bank name is required (5-100 characters)'
    },
    'repatriation_date': {
        required: true,
        type: 'date',
        minDate: null,
        maxDate: null,
        errorMessage: 'Repatriation date is required'
    },
    'rbi_caution_list': {
        required: false,
        type: 'select',
        options: ['am/are not', 'am/are'],
        errorMessage: 'Please select RBI caution list status'
    },
    'exporter_name': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Exporter name is required (2-100 characters)'
    },

    // Tax Challan Fields
    'challan_no': {
        required: true,
        type: 'text',
        minLength: 1,
        maxLength: 30,
        pattern: /^[A-Z0-9\-\/]+$/,
        errorMessage: 'Challan number is required (letters, numbers, hyphens, slashes only)'
    },
    'challan_date': {
        required: true,
        type: 'date',
        minDate: '2020-01-01',
        maxDate: null,
        errorMessage: 'Challan date is required'
    },
    'po_number': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 30,
        pattern: null,
        errorMessage: 'PO number must be 30 characters or less'
    },
    'po_date': {
        required: false,
        type: 'date',
        minDate: '2020-01-01',
        maxDate: null,
        errorMessage: 'PO date must be after 2020'
    },
    'eway_bill': {
        required: false,
        type: 'text',
        minLength: 12,
        maxLength: 12,
        pattern: /^[0-9]{12}$/,
        errorMessage: 'E-way bill must be exactly 12 digits'
    },
    'supplier_name': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Supplier name is required (2-100 characters)'
    },
    'supplier_address': {
        required: true,
        type: 'textarea',
        minLength: 10,
        maxLength: 300,
        pattern: null,
        errorMessage: 'Supplier address is required (minimum 10 characters)'
    },
    'supplier_gstin': {
        required: true,
        type: 'text',
        minLength: 15,
        maxLength: 15,
        pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        errorMessage: 'Supplier GSTIN is required and must be in valid format'
    },
    'receiver_name': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Receiver name is required (2-100 characters)'
    },
    'receiver_address': {
        required: true,
        type: 'textarea',
        minLength: 10,
        maxLength: 300,
        pattern: null,
        errorMessage: 'Receiver address is required (minimum 10 characters)'
    },
    'receiver_gstin': {
        required: false,
        type: 'text',
        minLength: 15,
        maxLength: 15,
        pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        errorMessage: 'Receiver GSTIN must be in valid format if provided'
    },
    'transport_mode': {
        required: false,
        type: 'select',
        options: ['ROAD', 'RAIL', 'AIR', 'SHIP', 'COURIER'],
        errorMessage: 'Please select valid transport mode'
    },
    'vehicle_no': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 20,
        pattern: null,
        errorMessage: 'Vehicle number must be 20 characters or less'
    },
    'transporter': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Transporter name must be 100 characters or less'
    },
    'lr_no': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 30,
        pattern: null,
        errorMessage: 'LR number must be 30 characters or less'
    },
    'dispatch_date': {
        required: false,
        type: 'date',
        minDate: '2020-01-01',
        maxDate: null,
        errorMessage: 'Dispatch date must be after 2020'
    },

    // Delivery Challan Fields
    'from_company': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: null,
        errorMessage: 'From company is required (2-100 characters)'
    },
    'to_company': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: null,
        errorMessage: 'To company is required (2-100 characters)'
    },
    'from_address': {
        required: true,
        type: 'textarea',
        minLength: 10,
        maxLength: 300,
        pattern: null,
        errorMessage: 'From address is required (minimum 10 characters)'
    },
    'to_address': {
        required: true,
        type: 'textarea',
        minLength: 10,
        maxLength: 300,
        pattern: null,
        errorMessage: 'To address is required (minimum 10 characters)'
    },
    'delivery_date': {
        required: false,
        type: 'date',
        minDate: '2020-01-01',
        maxDate: null,
        errorMessage: 'Delivery date must be after 2020'
    },
    'driver_name': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: /^[A-Za-z\s\.\-\']+$/,
        errorMessage: 'Driver name must contain only letters, spaces, dots, hyphens, and apostrophes'
    },
    'packaging_notes': {
        required: false,
        type: 'textarea',
        minLength: 0,
        maxLength: 300,
        pattern: null,
        errorMessage: 'Packaging notes must be 300 characters or less'
    },

    // LOA Enhanced Fields
    'iec_number': {
        required: true,
        type: 'text',
        minLength: 10,
        maxLength: 10,
        pattern: /^[0-9]{10}$/,
        errorMessage: 'IEC number must be exactly 10 digits'
    },
    'cha_license': {
        required: true,
        type: 'text',
        minLength: 5,
        maxLength: 30,
        pattern: null,
        errorMessage: 'CHA license number is required'
    },
    'customs_authority': {
        required: false,
        type: 'text',
        minLength: 5,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Customs authority must be 5-100 characters'
    },
    'valid_from': {
        required: true,
        type: 'date',
        minDate: null,
        maxDate: null,
        errorMessage: 'Valid from date is required'
    },
    'valid_to': {
        required: true,
        type: 'date',
        minDate: null,
        maxDate: null,
        errorMessage: 'Valid to date is required'
    },
    'signatory_designation': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Signatory designation is required'
    },

    // Annexure Document Fields
    'goods_description': {
        required: true,
        type: 'textarea',
        minLength: 5,
        maxLength: 500,
        pattern: null,
        errorMessage: 'Goods description is required'
    },
    'exporter_address': {
        required: true,
        type: 'textarea',
        minLength: 10,
        maxLength: 500,
        pattern: null,
        errorMessage: 'Exporter address is required'
    },
    'manufacturer_address': {
        required: false,
        type: 'textarea',
        minLength: 10,
        maxLength: 500,
        pattern: null,
        errorMessage: 'Manufacturer address must be at least 10 characters'
    },
    'manufacturer_name': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Manufacturer name is required'
    },
    'manufacturing_unit_address': {
        required: false,
        type: 'text',
        minLength: 5,
        maxLength: 200,
        pattern: null,
        errorMessage: 'Manufacturing unit address must be 5-200 characters'
    },
    'excise_procedure': {
        required: false,
        type: 'select',
        options: ['Not availed', 'Availed under rule 12(1)(b)/13(1)(b)', 'Availed under rule 191A/191B', 'Availed except notification 49/94-CE'],
        errorMessage: 'Please select valid excise procedure'
    },
    'deec_status': {
        required: false,
        type: 'select',
        options: ['Not under DEEC', 'Under DEEC - Central Excise only', 'Under DEEC - Brand rate', 'Under DEEC'],
        errorMessage: 'Please select valid DEEC status'
    },
    'excise_reg_no': {
        required: true,
        type: 'text',
        minLength: 5,
        maxLength: 20,
        pattern: null,
        errorMessage: 'Excise registration number is required'
    },
    'are1_no': {
        required: true,
        type: 'text',
        minLength: 5,
        maxLength: 20,
        pattern: null,
        errorMessage: 'ARE-1 number is required'
    },
    'quantity': {
        required: false,
        type: 'number',
        min: 0,
        max: 999999,
        errorMessage: 'Quantity must be a positive number'
    },
    'value_for_excise': {
        required: false,
        type: 'number',
        min: 0,
        max: 999999999,
        errorMessage: 'Value for excise must be a positive number'
    },
    'duty_involved': {
        required: false,
        type: 'number',
        min: 0,
        max: 999999999,
        errorMessage: 'Duty involved must be a positive number'
    },
    'export_type': {
        required: false,
        type: 'select',
        options: ['Direct by license holder', 'By third party'],
        errorMessage: 'Please select valid export type'
    },
    'superintendent_name': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Za-z\s\.\-\']+$/,
        errorMessage: 'Superintendent name must contain only letters, spaces, dots, hyphens, and apostrophes'
    },
    'excise_range': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Excise range must be 2-50 characters'
    },

    // EOU Certificate Fields
    'range': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Range must be 2-50 characters'
    },
    'division': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Division must be 2-50 characters'
    },
    'commissionerate': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Commissionerate must be 2-50 characters'
    },
    'certificate_no': {
        required: false,
        type: 'text',
        minLength: 5,
        maxLength: 30,
        pattern: null,
        errorMessage: 'Certificate number must be 5-30 characters'
    },
    'certificate_date': {
        required: false,
        type: 'date',
        minDate: '2020-01-01',
        maxDate: null,
        errorMessage: 'Certificate date must be after 2020'
    },
    'eou_name': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: null,
        errorMessage: 'EOU name is required'
    },
    'factory_address': {
        required: true,
        type: 'textarea',
        minLength: 10,
        maxLength: 300,
        pattern: null,
        errorMessage: 'Factory address is required'
    },
    'examination_date': {
        required: false,
        type: 'date',
        minDate: '2020-01-01',
        maxDate: null,
        errorMessage: 'Examination date must be after 2020'
    },
    'examining_officer': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Za-z\s\.\-\']+$/,
        errorMessage: 'Examining officer name must contain only letters, spaces, dots, hyphens, and apostrophes'
    },
    'supervising_officer': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Za-z\s\.\-\']+$/,
        errorMessage: 'Supervising officer name must contain only letters, spaces, dots, hyphens, and apostrophes'
    },
    'location_code': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 20,
        pattern: null,
        errorMessage: 'Location code must be 2-20 characters'
    },
    'total_packages': {
        required: false,
        type: 'number',
        min: 1,
        max: 99999,
        errorMessage: 'Total packages must be a positive number'
    },
    'consignee_name': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Consignee name is required'
    },
    'goods_description_correct': {
        required: false,
        type: 'select',
        options: ['Yes', 'No'],
        errorMessage: 'Please select if goods description is correct'
    },
    'sample_drawn': {
        required: false,
        type: 'select',
        options: ['Yes', 'No'],
        errorMessage: 'Please select if sample was drawn'
    },
    'seal_details': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Seal details must be 100 characters or less'
    },
    'container_details': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Container details must be 100 characters or less'
    },

    // Country Declaration Fields
    'declarant_name': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: /^[A-Za-z\s\.\-\']+$/,
        errorMessage: 'Declarant name is required and must contain only letters, spaces, dots, hyphens, and apostrophes'
    },
    'country_a': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Z\s]+$/,
        errorMessage: 'Country A is required (uppercase letters only)'
    },
    'country_b': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Z\s]+$/,
        errorMessage: 'Country B must be uppercase letters only'
    },
    'country_c': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Z\s]+$/,
        errorMessage: 'Country C must be uppercase letters only'
    },
    'country_d': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Z\s]+$/,
        errorMessage: 'Country D must be uppercase letters only'
    },
    'exportation_date': {
        required: true,
        type: 'date',
        minDate: '2020-01-01',
        maxDate: null,
        errorMessage: 'Exportation date is required'
    },
    'made_in_country': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Z\s]+$/,
        errorMessage: 'Made in country must be uppercase letters only'
    },
    'signatory_title': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Signatory title must be 2-50 characters'
    },
    'company_name': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Company name is required'
    },
    'company_address': {
        required: false,
        type: 'textarea',
        minLength: 10,
        maxLength: 300,
        pattern: null,
        errorMessage: 'Company address must be at least 10 characters'
    },

    // Quota Fields
    'quota_amount': {
        required: true,
        type: 'text',
        minLength: 5,
        maxLength: 30,
        pattern: null,
        errorMessage: 'Quota amount is required'
    },
    'paid_by': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Paid by is required'
    },
    'paid_to': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Paid to is required'
    },
    'quota_included': {
        required: false,
        type: 'select',
        options: ['Yes', 'No'],
        errorMessage: 'Please select if quota is included'
    },
    'statement_date': {
        required: true,
        type: 'date',
        minDate: '2020-01-01',
        maxDate: null,
        errorMessage: 'Statement date is required'
    },

    // TSCA Fields
    'certification_type': {
        required: false,
        type: 'select',
        options: ['Positive Certification', 'Negative Certification'],
        errorMessage: 'Please select certification type'
    },
    'authorized_name': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: /^[A-Za-z\s\.\-\']+$/,
        errorMessage: 'Authorized name is required and must contain only letters, spaces, dots, hyphens, and apostrophes'
    },

    // GR Waiver Fields
    'bank_address': {
        required: false,
        type: 'textarea',
        minLength: 10,
        maxLength: 300,
        pattern: null,
        errorMessage: 'Bank address must be at least 10 characters'
    },
    'repair_reason': {
        required: false,
        type: 'text',
        minLength: 5,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Repair reason must be 5-100 characters'
    },
    'bank_signatory': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Za-z\s\.\-\']+$/,
        errorMessage: 'Bank signatory name must contain only letters, spaces, dots, hyphens, and apostrophes'
    },
    'bank_designation': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Bank designation must be 2-50 characters'
    },

    // MSDS Fields
    'commodity_name': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Commodity name is required'
    },
    'preparation': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Preparation must be 100 characters or less'
    },
    'chemical_name': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Chemical name must be 100 characters or less'
    },
    'chemical_formula': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Chemical formula must be 50 characters or less'
    },
    'index_number': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 30,
        pattern: null,
        errorMessage: 'Index number must be 30 characters or less'
    },
    'risk_phrases': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 200,
        pattern: null,
        errorMessage: 'Risk phrases must be 200 characters or less'
    },
    'physical_form': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Physical form must be 50 characters or less'
    },
    'melting_point': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 30,
        pattern: null,
        errorMessage: 'Melting point must be 30 characters or less'
    },
    'water_solubility': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Water solubility must be 50 characters or less'
    },
    'flash_point': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 30,
        pattern: null,
        errorMessage: 'Flash point must be 30 characters or less'
    },
    'oral_toxicity': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Oral toxicity must be 50 characters or less'
    },
    'dermal_toxicity': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Dermal toxicity must be 50 characters or less'
    },
    'inhalation_toxicity': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Inhalation toxicity must be 50 characters or less'
    },
    'transport_class': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 20,
        pattern: null,
        errorMessage: 'Transport class must be 20 characters or less'
    },

    // Domestic Shipping Fields
    'supplier_state': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Supplier state must be 2-50 characters'
    },
    'eway_valid': {
        required: false,
        type: 'date',
        minDate: '2020-01-01',
        maxDate: null,
        errorMessage: 'E-way bill validity date must be after 2020'
    },
    'receiver_state': {
        required: false,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Receiver state must be 2-50 characters'
    },
    'supply_type': {
        required: false,
        type: 'select',
        options: ['Inter-State', 'Intra-State'],
        errorMessage: 'Please select valid supply type'
    },
    'reverse_charge': {
        required: false,
        type: 'select',
        options: ['No', 'Yes'],
        errorMessage: 'Please select reverse charge applicability'
    },

    // COO Fields
    'country_destination': {
        required: true,
        type: 'text',
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Z\s]+$/,
        errorMessage: 'Country of destination is required (uppercase letters only)'
    },
    'departure_date': {
        required: true,
        type: 'date',
        minDate: '2020-01-01',
        maxDate: null,
        errorMessage: 'Departure date is required'
    },
    'vessel_aircraft': {
        required: false,
        type: 'text',
        minLength: 0,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Vessel/aircraft must be 50 characters or less'
    },
    'origin_criterion': {
        required: false,
        type: 'select',
        options: ['P - Wholly Produced', 'W - Wholly Obtained', 'PE - Product Specific Rule'],
        errorMessage: 'Please select valid origin criterion'
    },
    'number_packages': {
        required: false,
        type: 'number',
        min: 1,
        max: 99999,
        errorMessage: 'Number of packages must be a positive number'
    },
    'certifying_authority': {
        required: false,
        type: 'text',
        minLength: 5,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Certifying authority must be 5-100 characters'
    },
    'certification_date': {
        required: true,
        type: 'date',
        minDate: '2020-01-01',
        maxDate: null,
        errorMessage: 'Certification date is required'
    },

    // NON-DG Fields
    'mawb_number': {
        required: false,
        type: 'text',
        minLength: 8,
        maxLength: 20,
        pattern: /^[A-Z0-9\-]+$/,
        errorMessage: 'MAWB number must be 8-20 characters (letters/numbers/hyphens only)'
    },
    'airport_departure': {
        required: true,
        type: 'text',
        minLength: 3,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Airport of departure is required'
    },
    'airport_destination': {
        required: true,
        type: 'text',
        minLength: 3,
        maxLength: 50,
        pattern: null,
        errorMessage: 'Airport of destination is required'
    },
    'shipper_address': {
        required: true,
        type: 'textarea',
        minLength: 10,
        maxLength: 300,
        pattern: null,
        errorMessage: 'Shipper address is required'
    },

    // Document Title Field
    'document_title': {
        required: false,
        type: 'text',
        minLength: 5,
        maxLength: 100,
        pattern: null,
        errorMessage: 'Document title must be 5-100 characters'
    }
};
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate a single field value against its scheme
 * @param {string} fieldKey - The field key
 * @param {any} value - The field value
 * @param {string} docType - Document type for context
 * @returns {object} - {isValid: boolean, error: string}
 */
function validateField(fieldKey, value, docType = '') {
    const scheme = VALIDATION_SCHEME[fieldKey];
    if (!scheme) {
        return { isValid: true, error: null }; // No validation scheme = valid
    }

    // Check if required
    if (scheme.required && (!value || value.toString().trim() === '')) {
        return { isValid: false, error: scheme.errorMessage || `${fieldKey} is required` };
    }

    // If not required and empty, skip other validations
    if (!scheme.required && (!value || value.toString().trim() === '')) {
        return { isValid: true, error: null };
    }

    const strValue = value.toString().trim();

    // Type-specific validations
    switch (scheme.type) {
        case 'text':
        case 'textarea':
            // Length validation
            if (scheme.minLength && strValue.length < scheme.minLength) {
                return { isValid: false, error: scheme.errorMessage || `Minimum ${scheme.minLength} characters required` };
            }
            if (scheme.maxLength && strValue.length > scheme.maxLength) {
                return { isValid: false, error: scheme.errorMessage || `Maximum ${scheme.maxLength} characters allowed` };
            }
            // Pattern validation
            if (scheme.pattern && !scheme.pattern.test(strValue)) {
                return { isValid: false, error: scheme.errorMessage || `Invalid format for ${fieldKey}` };
            }
            break;

        case 'number':
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
                return { isValid: false, error: scheme.errorMessage || `${fieldKey} must be a valid number` };
            }
            if (scheme.min !== undefined && numValue < scheme.min) {
                return { isValid: false, error: scheme.errorMessage || `Minimum value is ${scheme.min}` };
            }
            if (scheme.max !== undefined && numValue > scheme.max) {
                return { isValid: false, error: scheme.errorMessage || `Maximum value is ${scheme.max}` };
            }
            break;

        case 'date':
            const dateValue = new Date(value);
            if (isNaN(dateValue.getTime())) {
                return { isValid: false, error: scheme.errorMessage || `${fieldKey} must be a valid date` };
            }
            if (scheme.minDate) {
                const minDate = new Date(scheme.minDate);
                if (dateValue < minDate) {
                    return { isValid: false, error: scheme.errorMessage || `Date must be after ${scheme.minDate}` };
                }
            }
            if (scheme.maxDate) {
                const maxDate = new Date(scheme.maxDate);
                if (dateValue > maxDate) {
                    return { isValid: false, error: scheme.errorMessage || `Date must be before ${scheme.maxDate}` };
                }
            }
            break;

        case 'select':
            if (scheme.options && !scheme.options.includes(strValue)) {
                return { isValid: false, error: scheme.errorMessage || `Please select a valid option` };
            }
            break;
    }

    return { isValid: true, error: null };
}

/**
 * Validate all fields in a document
 * @param {object} formData - The form data object
 * @param {string} docType - Document type
 * @returns {object} - {isValid: boolean, errors: object, errorCount: number}
 */
function validateDocument(formData, docType) {
    const errors = {};
    let errorCount = 0;

    for (const [fieldKey, value] of Object.entries(formData)) {
        // Skip special fields like items, packing_list, etc.
        if (['items', 'packing_list', 'packages'].includes(fieldKey)) {
            continue;
        }

        const validation = validateField(fieldKey, value, docType);
        if (!validation.isValid) {
            errors[fieldKey] = validation.error;
            errorCount++;
        }
    }

    return {
        isValid: errorCount === 0,
        errors: errors,
        errorCount: errorCount
    };
}

/**
 * Get validation scheme for a specific field
 * @param {string} fieldKey - The field key
 * @returns {object|null} - The validation scheme or null
 */
function getFieldValidation(fieldKey) {
    return VALIDATION_SCHEME[fieldKey] || null;
}

/**
 * Check if a field is required
 * @param {string} fieldKey - The field key
 * @returns {boolean} - True if required
 */
function isFieldRequired(fieldKey) {
    const scheme = VALIDATION_SCHEME[fieldKey];
    return scheme ? scheme.required : false;
}

// ============================================================================
// DOCUMENT-SPECIFIC VALIDATION PROFILES
// ============================================================================
const DOC_VALIDATION_PROFILES = {
    'COM_INV': {
        required: ['exporter_details', 'invoice_no', 'invoice_date', 'consignee_details', 'country_dest'],
        optional: ['reference_id', 'iec', 'exporter_ref', 'other_ref', 'buyer_order', 'buyer_date', 'buyer_details', 'country_origin', 'pre_carriage', 'place_receipt', 'vessel_flight_no', 'port_loading', 'port_discharge', 'final_dest', 'terms', 'payment_terms', 'currency', 'exchange_rate', 'declaration']
    },
    'PKL': {
        required: ['exporter_details', 'consignee_details'],
        optional: ['reference_id', 'invoice_no', 'invoice_date', 'buyer_order', 'vessel_flight', 'port_loading', 'port_discharge', 'final_dest', 'marks_numbers', 'special_instructions']
    },
    'KYC': {
        required: ['entity_type', 'entity_name', 'permanent_address', 'business_address', 'auth_signatories', 'iec_no', 'pan', 'declaration_text', 'authorized_signatory_name', 'authorized_signatory_designation', 'declaration_place', 'declaration_date'],
        optional: ['reference_id']
    },
    'SLI': {
        required: ['shipper_name', 'consignee_name', 'invoice_no', 'sli_date', 'forwarder_name'],
        optional: ['reference_id', 'e_code', 'bank_ad_code', 'currency', 'incoterms', 'payment_terms', 'invoice_value', 'freight', 'insurance', 'commission', 'discount', 'no_of_pkgs', 'net_weight', 'gross_weight', 'volume_weight', 'special_instructions']
    },
    'BL_AWB': {
        required: ['exporter_details', 'consignee_details', 'carrier_name', 'awb_number'],
        optional: ['reference_id', 'invoice_no', 'invoice_date', 'port_of_loading', 'port_of_discharge', 'vessel_flight_no', 'country_dest', 'description_of_goods']
    },
    'INS_CERT': {
        required: ['exporter_details', 'consignee_details', 'policy_no', 'insured_amount'],
        optional: ['reference_id', 'invoice_no', 'invoice_date', 'awb_number', 'insured_party', 'subject_matter', 'country_dest', 'description_of_goods']
    },
    'SDF': {
        required: ['shipping_bill_no', 'shipping_bill_date', 'bank_name', 'repatriation_date', 'exporter_name', 'declaration_date'],
        optional: ['reference_id', 'seller_consignor', 'value_ascertainment', 'rbi_caution_list']
    },
    'ANN_1': {
        required: ['goods_description', 'invoice_no', 'invoice_date', 'exporter_name', 'exporter_address', 'declaration_date'],
        optional: ['reference_id', 'manufacturer_address', 'manufacturing_unit_address']
    },
    'ANN_2': {
        required: ['goods_description', 'invoice_no', 'invoice_date', 'exporter_name', 'manufacturer_name', 'manufacturer_address', 'declaration_date'],
        optional: ['reference_id', 'exporter_address', 'manufacturing_unit_address']
    },
    'ARE1': {
        required: ['exporter_details', 'are1_no', 'excise_reg_no'],
        optional: ['reference_id', 'consignee_details', 'invoice_no', 'invoice_date', 'description_of_goods', 'quantity', 'value_for_excise', 'duty_involved', 'country_dest', 'awb_number']
    },
    'APP_3': {
        required: ['shipping_bill_no', 'shipping_bill_date', 'exporter_name', 'declaration_date'],
        optional: ['reference_id', 'excise_procedure', 'deec_status']
    },
    'APP_4': {
        required: ['shipping_bill_no', 'shipping_bill_date', 'exporter_name', 'exporter_address'],
        optional: ['reference_id', 'superintendent_name', 'excise_range']
    },
    'APP_2': {
        required: ['shipping_bill_no', 'shipping_bill_date', 'exporter_name'],
        optional: ['reference_id', 'excise_procedure', 'export_type']
    },
    'ANN_C1': {
        required: ['shipping_bill_no', 'shipping_bill_date', 'eou_name', 'iec_no', 'factory_address'],
        optional: ['reference_id', 'range', 'division', 'commissionerate', 'certificate_no', 'certificate_date', 'examination_date', 'examining_officer', 'supervising_officer', 'location_code', 'invoice_no', 'total_packages', 'consignee_name', 'goods_description_correct', 'sample_drawn', 'seal_details', 'container_details']
    },
    'SCD': {
        required: ['declarant_name', 'country_origin', 'description_goods', 'exportation_date', 'declaration_date', 'signatory_name', 'company_name'],
        optional: ['reference_id', 'country_b', 'country_c', 'country_d', 'marks_numbers', 'made_in_country', 'signatory_title', 'company_address']
    },
    'MCD': {
        required: ['declarant_name', 'country_a', 'signatory_name', 'company_name', 'declaration_date'],
        optional: ['reference_id', 'country_b', 'country_c', 'country_d', 'signatory_title', 'company_address']
    },
    'NEG_DEC': {
        required: ['declarant_name', 'declaration_date', 'signatory_name', 'company_name'],
        optional: ['reference_id', 'signatory_title', 'company_address']
    },
    'QUOTA': {
        required: ['company_name', 'invoice_no', 'invoice_date', 'quota_amount', 'paid_by', 'paid_to', 'statement_date'],
        optional: ['reference_id', 'quota_included', 'signatory_title', 'company_address']
    },
    'TSCA': {
        required: ['company_name', 'company_address', 'authorized_name', 'certificate_date'],
        optional: ['reference_id', 'certification_type', 'signatory_title', 'awb_number']
    },
    'GR_SAMPLE': {
        required: ['certificate_date', 'shipper_name', 'consignee_name', 'description', 'invoice_no', 'invoice_date'],
        optional: ['reference_id', 'bank_name', 'bank_address', 'customs_authority', 'invoice_value', 'bank_signatory', 'bank_designation']
    },
    'GR_REPAIR': {
        required: ['certificate_date', 'shipper_name', 'consignee_name', 'description', 'invoice_no', 'invoice_date', 'invoice_value'],
        optional: ['reference_id', 'bank_name', 'bank_address', 'customs_authority', 'repair_reason', 'bank_signatory', 'bank_designation']
    },
    'MSDS': {
        required: ['commodity_name', 'manufacturer_name', 'manufacturer_address'],
        optional: ['reference_id', 'preparation', 'chemical_name', 'chemical_formula', 'index_number', 'risk_phrases', 'physical_form', 'melting_point', 'water_solubility', 'flash_point', 'oral_toxicity', 'dermal_toxicity', 'inhalation_toxicity', 'transport_class']
    },
    'TAX_CHALLAN': {
        required: ['supplier_name', 'supplier_address', 'supplier_gstin', 'challan_no', 'challan_date', 'receiver_name', 'receiver_address'],
        optional: ['reference_id', 'document_title', 'supplier_state', 'po_number', 'po_date', 'eway_bill', 'eway_valid', 'receiver_gstin', 'receiver_state', 'transport_mode', 'vehicle_no', 'transporter', 'lr_no', 'dispatch_date', 'supply_type', 'reverse_charge', 'declaration']
    },
    'DELIVERY_CHALLAN': {
        required: ['challan_no', 'challan_date', 'from_company', 'to_company', 'from_address', 'to_address'],
        optional: ['reference_id', 'document_title', 'delivery_date', 'vehicle_no', 'driver_name', 'special_instructions', 'packaging_notes']
    },
    'LOA': {
        required: ['exporter_name', 'exporter_address', 'iec_number', 'cha_name', 'cha_license', 'valid_from', 'valid_to', 'signatory_name', 'signatory_designation'],
        optional: ['reference_id', 'gstin', 'pan', 'customs_authority', 'shipping_bill_no', 'invoice_no', 'invoice_date', 'vessel_flight', 'port_loading']
    },
    'COO': {
        required: ['exporter_name', 'exporter_address', 'country_origin', 'consignee_name', 'consignee_address', 'country_destination', 'departure_date', 'description_goods', 'invoice_no', 'invoice_date', 'certification_date'],
        optional: ['reference_id', 'vessel_aircraft', 'transport_mode', 'port_loading', 'port_discharge', 'marks_numbers', 'origin_criterion', 'gross_weight', 'number_packages', 'certifying_authority', 'declaration_place']
    },
    'NON_DG': {
        required: ['awb_number', 'airport_departure', 'airport_destination', 'shipper_name', 'shipper_address', 'signatory_name', 'signatory_designation'],
        optional: ['reference_id', 'mawb_number', 'total_packages', 'net_weight', 'gross_weight']
    }
};

// ============================================================================
// ENHANCED VALIDATION FUNCTIONS
// ============================================================================

/**
 * Get all required fields for a document type (legacy function)
 * @param {string} docType - Document type
 * @returns {array} - Array of required field keys
 */
function getRequiredFields(docType) {
    // Use document-specific profile if available
    if (DOC_VALIDATION_PROFILES[docType]) {
        return DOC_VALIDATION_PROFILES[docType].required;
    }
    // Fallback to all globally required fields
    return Object.keys(VALIDATION_SCHEME).filter(key => VALIDATION_SCHEME[key].required);
}

/**
 * Get required fields for a specific document type
 * @param {string} docType - Document type
 * @returns {array} - Array of required field keys
 */
function getRequiredFieldsForDoc(docType) {
    const profile = DOC_VALIDATION_PROFILES[docType];
    return profile ? profile.required : [];
}

/**
 * Check if a field is required for a specific document type
 * @param {string} fieldKey - The field key
 * @param {string} docType - Document type
 * @returns {boolean} - True if required for this document type
 */
function isFieldRequiredForDoc(fieldKey, docType) {
    const profile = DOC_VALIDATION_PROFILES[docType];
    return profile ? profile.required.includes(fieldKey) : false;
}

/**
 * Validate a single field with document-specific requirements
 * @param {string} fieldKey - The field key
 * @param {any} value - The field value
 * @param {string} docType - Document type for context
 * @returns {object} - {isValid: boolean, error: string}
 */
function validateFieldForDoc(fieldKey, value, docType) {
    const scheme = VALIDATION_SCHEME[fieldKey];
    if (!scheme) {
        return { isValid: true, error: null }; // No validation scheme = valid
    }

    // Check if required for this document type
    const isRequired = isFieldRequiredForDoc(fieldKey, docType);
    if (isRequired && (!value || value.toString().trim() === '')) {
        return { isValid: false, error: scheme.errorMessage || `${fieldKey} is required for ${docType}` };
    }

    // If not required and empty, skip other validations
    if (!isRequired && (!value || value.toString().trim() === '')) {
        return { isValid: true, error: null };
    }

    // Use existing validation logic for type-specific checks
    return validateField(fieldKey, value, docType);
}

/**
 * Validate all fields in a document with document-specific rules
 * @param {object} formData - The form data object
 * @param {string} docType - Document type
 * @returns {object} - {isValid: boolean, errors: object, errorCount: number}
 */
function validateDocumentWithProfile(formData, docType) {
    const errors = {};
    let errorCount = 0;
    const profile = DOC_VALIDATION_PROFILES[docType];

    if (!profile) {
        // Fallback to generic validation if no profile exists
        return validateDocument(formData, docType);
    }

    // Check all required fields for this document type
    for (const fieldKey of profile.required) {
        const value = formData[fieldKey];
        const validation = validateFieldForDoc(fieldKey, value, docType);
        if (!validation.isValid) {
            errors[fieldKey] = validation.error;
            errorCount++;
        }
    }

    // Check optional fields that have values
    for (const fieldKey of profile.optional) {
        const value = formData[fieldKey];
        if (value && value.toString().trim() !== '') {
            const validation = validateFieldForDoc(fieldKey, value, docType);
            if (!validation.isValid) {
                errors[fieldKey] = validation.error;
                errorCount++;
            }
        }
    }

    return {
        isValid: errorCount === 0,
        errors: errors,
        errorCount: errorCount
    };
}

// ============================================================================
// EXPORT FOR USE IN OTHER FILES
// ============================================================================
if (typeof window !== 'undefined') {
    // Browser environment
    window.VALIDATION_SCHEME = VALIDATION_SCHEME;
    window.DOC_VALIDATION_PROFILES = DOC_VALIDATION_PROFILES;
    window.validateField = validateField;
    window.validateDocument = validateDocument;
    window.validateFieldForDoc = validateFieldForDoc;
    window.validateDocumentWithProfile = validateDocumentWithProfile;
    window.getFieldValidation = getFieldValidation;
    window.isFieldRequired = isFieldRequired;
    window.isFieldRequiredForDoc = isFieldRequiredForDoc;
    window.getRequiredFields = getRequiredFields;
    window.getRequiredFieldsForDoc = getRequiredFieldsForDoc;
}

// Node.js environment (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        VALIDATION_SCHEME,
        DOC_VALIDATION_PROFILES,
        validateField,
        validateDocument,
        validateFieldForDoc,
        validateDocumentWithProfile,
        getFieldValidation,
        isFieldRequired,
        isFieldRequiredForDoc,
        getRequiredFields,
        getRequiredFieldsForDoc
    };
}