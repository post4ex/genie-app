/**
 * docs-config.js
 * Configuration data for the Document Center.
 * Contains schemas, field mappings, and decision guide.
 */
const FIELD_MAPPINGS = {
    // --- Common Fields (Mutual) ---
    '_COMMON': {
        'reference_id':     ['REFERANCE', 'REFERENCE'],
        'invoice_no':       ['REFERANCE', 'INVOICE_NO', 'REF_NO', 'DOC_NUMBER'],
        'invoice_date':     ['ORDER_DATE', 'DATE', 'BOOKING_DATE'],
        'awb_number':       ['AWB_NUMBER', 'AWB', 'TRACKING_NO'],
        'exporter_details': ['CONSIGNOR_NAME', 'CONSIGNOR_ADDRESS', 'CONSIGNOR_FULL'], 
        'consignee_details':['CONSIGNEE_NAME', 'CONSIGNEE_ADDRESS', 'CONSIGNEE_FULL'],
        'country_dest':     ['DESTINATION_COUNTRY', 'COUNTRY'],
        'place_supply':     ['DESTINATION_STATE', 'STATE'],
        'gstin':            ['GSTIN', 'GST_NO', 'ID_GST_PAN_ADHAR'],
        'description_of_goods': ['PRODUCT'],
        // Structured address fields with API integration
        'exporter_name':    ['CONSIGNOR_NAME', 'EXPORTER_NAME', 'COMPANY_NAME'],
        'exporter_address': ['CONSIGNOR_ADDRESS', 'EXPORTER_ADDRESS', 'COMPANY_ADDRESS'],
        'exporter_address_line1': ['CONSIGNOR_ADDRESS', 'EXPORTER_ADDRESS', 'COMPANY_ADDRESS'],
        'exporter_address_line2': ['CONSIGNOR_ADDRESS_2'],
        'exporter_city':    ['CONSIGNOR_CITY', 'EXPORTER_CITY', 'COMPANY_CITY'],
        'exporter_state':   ['CONSIGNOR_STATE', 'EXPORTER_STATE', 'COMPANY_STATE'],
        'exporter_pincode': ['CONSIGNOR_PINCODE', 'EXPORTER_PINCODE', 'COMPANY_PINCODE'],
        'exporter_country': ['CONSIGNOR_COUNTRY', 'EXPORTER_COUNTRY', 'COMPANY_COUNTRY'],
        'consignee_name':   ['CONSIGNEE_NAME'],
        'consignee_address':['CONSIGNEE_ADDRESS'],
        'consignee_address_line1': ['CONSIGNEE_ADDRESS'],
        'consignee_address_line2': ['CONSIGNEE_ADDRESS_2'],
        'consignee_city':   ['CONSIGNEE_CITY'],
        'consignee_state':  ['CONSIGNEE_STATE'],
        'consignee_pincode':['CONSIGNEE_PINCODE'],
        'consignee_country':['CONSIGNEE_COUNTRY', 'DESTINATION_COUNTRY'],
        'shipping_bill_no': ['SB_NO', 'SHIPPING_BILL'],
        'shipping_bill_date': ['ORDER_DATE', 'DATE'],
        'declaration_date': ['ORDER_DATE', 'DATE'],
        'signatory_name':   ['CONTACT_PERSON', 'AUTH_NAME'],
        'signatory_title':  ['DESIGNATION', 'AUTH_ROLE'],
        'company_name':     ['CONSIGNOR_NAME', 'B2B_NAME'],
        'company_address':  ['CONSIGNOR_ADDRESS', 'B2B_ADDRESS'],
        'company_address_line1': ['CONSIGNOR_ADDRESS', 'B2B_ADDRESS'],
        'company_address_line2': ['CONSIGNOR_ADDRESS_2', 'B2B_ADDRESS_2'],
        'company_city':     ['CONSIGNOR_CITY', 'B2B_CITY'],
        'company_state':    ['CONSIGNOR_STATE', 'B2B_STATE'],
        'company_pincode':  ['CONSIGNOR_PINCODE', 'B2B_PINCODE'],
        'company_country':  ['CONSIGNOR_COUNTRY', 'B2B_COUNTRY'],
        'iec_number':       ['IEC', 'IEC_CODE'],
        'pan':              ['PAN', 'PAN_NO', 'PAN_NUMBER'],
        'country_origin':   ['ORIGIN_COUNTRY', 'COUNTRY_OF_ORIGIN'],
        'marks_numbers':    ['MARKS', 'BOX_NO'],
        'goods_description': ['PRODUCT', 'CONTENT', 'DESC'],
        'vessel_flight_no': ['FLIGHT_NO', 'VEHICLE_NO'],
        'port_loading':     ['ORIGIN_CITY', 'ORIGIN', 'FROM_CITY'],
        'port_discharge':   ['DESTINATION_CITY', 'DESTINATION', 'TO_CITY'],
        'certificate_date': ['ORDER_DATE', 'DATE'],
        'authorized_signatory': ['CONTACT_PERSON', 'AUTH_NAME']
    },

    // --- Specific Document Mappings (Overrides _COMMON) ---
    'KYC': {
        'entity_type':      ['ENTITY_TYPE', 'CATEGORY', 'B2B_TYPE'],
        'entity_name':      ['CONSIGNOR_NAME', 'NAME', 'CLIENT_NAME', 'B2B_NAME'],
        'permanent_address':['CONSIGNOR_ADDRESS', 'ADDRESS', 'REGISTERED_ADDRESS', 'B2B_ADDRESS'],
        'permanent_address_line1': ['CONSIGNOR_ADDRESS', 'ADDRESS', 'REGISTERED_ADDRESS'],
        'permanent_address_line2': ['CONSIGNOR_ADDRESS_2', 'ADDRESS_2'],
        'permanent_city':   ['CONSIGNOR_CITY', 'CITY', 'REGISTERED_CITY'],
        'permanent_state':  ['CONSIGNOR_STATE', 'STATE', 'REGISTERED_STATE'],
        'permanent_pincode':['CONSIGNOR_PINCODE', 'PINCODE', 'REGISTERED_PINCODE'],
        'permanent_country':['CONSIGNOR_COUNTRY', 'COUNTRY', 'REGISTERED_COUNTRY'],
        'business_address': ['CONSIGNOR_ADDRESS', 'ADDRESS', 'BUSINESS_ADDRESS', 'B2B_ADDRESS'],
        'business_address_line1': ['BUSINESS_ADDRESS', 'B2B_ADDRESS'],
        'business_address_line2': ['BUSINESS_ADDRESS_2', 'B2B_ADDRESS_2'],
        'business_city':    ['BUSINESS_CITY', 'B2B_CITY'],
        'business_state':   ['BUSINESS_STATE', 'B2B_STATE'],
        'business_pincode': ['BUSINESS_PINCODE', 'B2B_PINCODE'],
        'business_country': ['BUSINESS_COUNTRY', 'B2B_COUNTRY'],
        'auth_signatories': ['AUTH_SIGNATORIES', 'CONTACT_PERSON'],
        'iec_no':           ['IEC', 'IEC_CODE', 'IEC_NO'],
        'authorized_signatory_name': ['CONTACT_PERSON', 'AUTH_NAME'],
        'authorized_signatory_designation': ['DESIGNATION', 'AUTH_ROLE'],
        'declaration_place':['CONSIGNOR_CITY', 'CITY', 'BRANCH', 'B2B_CITY']
    },
    
    'COM_INV': {
        'iec':              ['IEC', 'IEC_CODE'],
        'terms':            ['INCOTERMS', 'TERMS'],
        'buyer_order':      ['REFERANCE', 'PO_NUMBER']
    },

    'PKL': {
        'total_pkgs':       ['PIECS', 'TOTAL_BOXES', 'NO_OF_PKGS', 'BOX_NUM'],
        'net_wt':           ['WEIGHT', 'NET_WEIGHT'],
        'gross_wt':         ['GROSS_WEIGHT', 'VOL_WEIGHT', 'CHG_WT']
    },

    'SLI': {
        'forwarder_name':   ['FORWARDER', 'CARRIER', 'VENDOR'],
        'special_instructions': ['REMARKS', 'INSTRUCTIONS', 'NOTE'],
        'shipper_name':     ['CONSIGNOR_NAME', 'EXPORTER_NAME'],
        'consignee_name':   ['CONSIGNEE_NAME'],
        'invoice_no':       ['REFERANCE', 'INVOICE_NO', 'REF_NO'],
        'e_code':           ['E_CODE', 'IEC'],
        'bank_ad_code':     ['BANK_AD_CODE', 'AD_CODE'],
        'currency':         ['CURRENCY'],
        'incoterms':        ['INCOTERMS', 'TERMS'],
        'payment_terms':    ['PAYMENT_TERMS'],
        'invoice_value':    ['DECLARED_VALUE', 'VALUE', 'AMOUNT'],
        'freight':          ['FREIGHT'],
        'insurance':        ['INSURANCE'],
        'no_of_pkgs':       ['PIECS', 'TOTAL_BOXES', 'NO_OF_PKGS'],
        'net_weight':       ['WEIGHT', 'NET_WEIGHT'],
        'gross_weight':     ['GROSS_WEIGHT', 'CHG_WT'],
        'volume_weight':    ['VOL_WEIGHT']
    },
    'BL_AWB': {
        'carrier_name':     ['CARRIER', 'TRANSPORTER'],
        'port_of_loading':  ['ORIGIN_CITY', 'ORIGIN', 'FROM_CITY'],
        'port_of_discharge':['DESTINATION_CITY', 'DESTINATION', 'TO_CITY'],
        'vessel_flight_no': ['FLIGHT_NO', 'VEHICLE_NO']
    },
    'SDF': {
        'shipping_bill_no': ['SB_NO', 'SHIPPING_BILL'],
        'shipping_bill_date': ['ORDER_DATE', 'DATE'],
        'bank_name':        ['BANK_NAME', 'BANK'],
        'repatriation_date': ['REPATRIATION_DATE'],
        'exporter_name':    ['CONSIGNOR_NAME', 'EXPORTER_NAME'],
        'currency':         ['CURRENCY'],
        'amount':           ['DECLARED_VALUE', 'VALUE', 'AMOUNT', 'COD', 'TOPAY']
    },
    'ANN_1': {
        'goods_description': ['PRODUCT', 'CONTENT', 'DESC'],
        'invoice_no':        ['REFERANCE', 'INVOICE_NO', 'REF_NO'],
        'invoice_date':      ['ORDER_DATE', 'DATE', 'BOOKING_DATE'],
        'exporter_name':     ['CONSIGNOR_NAME', 'EXPORTER_NAME'],
        'exporter_address':  ['CONSIGNOR_ADDRESS', 'EXPORTER_ADDRESS']
    },
    'ANN_2': {
        'goods_description': ['PRODUCT', 'CONTENT', 'DESC'],
        'invoice_no':        ['REFERANCE', 'INVOICE_NO', 'REF_NO'],
        'invoice_date':      ['ORDER_DATE', 'DATE', 'BOOKING_DATE'],
        'manufacturer_name': ['MANUFACTURER_NAME', 'VENDOR'],
        'manufacturer_address': ['MANUFACTURER_ADDRESS'],
        'exporter_name':     ['CONSIGNOR_NAME', 'EXPORTER_NAME']
    },
    'APP_3': {
        'shipping_bill_no':  ['SB_NO', 'SHIPPING_BILL'],
        'shipping_bill_date': ['ORDER_DATE', 'DATE'],
        'exporter_name':     ['CONSIGNOR_NAME', 'EXPORTER_NAME'],
        'declaration_date':  ['ORDER_DATE', 'DATE'],
        'excise_procedure': ['EXCISE_PROCEDURE'],
        'deec_status': ['DEEC_STATUS']
    },
    'APP_4': {
        'shipping_bill_no':  ['SB_NO', 'SHIPPING_BILL'],
        'shipping_bill_date': ['ORDER_DATE', 'DATE'],
        'exporter_name':     ['CONSIGNOR_NAME', 'EXPORTER_NAME'],
        'exporter_address':  ['CONSIGNOR_ADDRESS', 'EXPORTER_ADDRESS'],
        'superintendent_name': ['SUPERINTENDENT_NAME'],
        'excise_range': ['EXCISE_RANGE']
    },
    'APP_2': {
        'shipping_bill_no':  ['SB_NO', 'SHIPPING_BILL'],
        'shipping_bill_date': ['ORDER_DATE', 'DATE'],
        'exporter_name':     ['CONSIGNOR_NAME', 'EXPORTER_NAME'],
        'excise_procedure': ['EXCISE_PROCEDURE'],
        'export_type': ['EXPORT_TYPE']
    },
    'ANN_C1': {
        'shipping_bill_no':  ['SB_NO', 'SHIPPING_BILL'],
        'shipping_bill_date': ['ORDER_DATE', 'DATE'],
        'eou_name':          ['CONSIGNOR_NAME', 'EOU_NAME'],
        'iec_no':            ['IEC', 'IEC_CODE'],
        'factory_address':   ['CONSIGNOR_ADDRESS', 'FACTORY_ADDRESS'],
        'invoice_no':        ['REFERANCE', 'INVOICE_NO'],
        'consignee_name':    ['CONSIGNEE_NAME'],
        'range': ['RANGE'],
        'division': ['DIVISION'],
        'commissionerate': ['COMMISSIONERATE'],
        'certificate_no': ['CERTIFICATE_NO'],
        'examination_date': ['EXAMINATION_DATE'],
        'examining_officer': ['EXAMINING_OFFICER'],
        'supervising_officer': ['SUPERVISING_OFFICER'],
        'location_code': ['LOCATION_CODE'],
        'total_packages': ['TOTAL_PACKAGES'],
        'goods_description_correct': ['GOODS_DESCRIPTION_CORRECT'],
        'sample_drawn': ['SAMPLE_DRAWN'],
        'seal_details': ['SEAL_DETAILS'],
        'container_details': ['CONTAINER_DETAILS']
    },
    'SCD': {
        'declarant_name':    ['CONSIGNOR_NAME', 'EXPORTER_NAME'],
        'country_origin':    ['ORIGIN_COUNTRY', 'COUNTRY_OF_ORIGIN'],
        'marks_numbers':     ['MARKS', 'BOX_NO'],
        'description_goods': ['PRODUCT', 'CONTENT', 'DESC'],
        'exportation_date':  ['ORDER_DATE', 'DATE'],
        'signatory_name':    ['CONTACT_PERSON', 'AUTH_NAME'],
        'signatory_title':   ['DESIGNATION', 'AUTH_ROLE'],
        'company_name':      ['CONSIGNOR_NAME', 'B2B_NAME'],
        'company_address':   ['CONSIGNOR_ADDRESS', 'B2B_ADDRESS'],
        'made_in_country':   ['ORIGIN_COUNTRY', 'COUNTRY_OF_ORIGIN']
    },
    'MCD': {
        'declarant_name':    ['CONSIGNOR_NAME', 'EXPORTER_NAME'],
        'country_a':         ['ORIGIN_COUNTRY', 'COUNTRY_OF_ORIGIN'],
        'signatory_name':    ['CONTACT_PERSON', 'AUTH_NAME'],
        'signatory_title':   ['DESIGNATION', 'AUTH_ROLE'],
        'company_name':      ['CONSIGNOR_NAME', 'B2B_NAME'],
        'company_address':   ['CONSIGNOR_ADDRESS', 'B2B_ADDRESS'],
        'country_b': ['COUNTRY_B'],
        'country_c': ['COUNTRY_C'],
        'country_d': ['COUNTRY_D']
    },
    'NEG_DEC': {
        'declarant_name':    ['CONSIGNOR_NAME', 'EXPORTER_NAME'],
        'marks_numbers':     ['MARKS', 'BOX_NO'],
        'description_goods': ['PRODUCT', 'CONTENT', 'DESC'],
        'country_origin':    ['ORIGIN_COUNTRY', 'COUNTRY_OF_ORIGIN'],
        'signatory_name':    ['CONTACT_PERSON', 'AUTH_NAME'],
        'signatory_title':   ['DESIGNATION', 'AUTH_ROLE'],
        'company_name':      ['CONSIGNOR_NAME', 'B2B_NAME'],
        'company_address':   ['CONSIGNOR_ADDRESS', 'B2B_ADDRESS']
    },
    'QUOTA': {
        'company_name':      ['CONSIGNOR_NAME', 'B2B_NAME'],
        'invoice_no':        ['REFERANCE', 'INVOICE_NO', 'REF_NO'],
        'invoice_date':      ['ORDER_DATE', 'DATE', 'BOOKING_DATE'],
        'quota_amount':      ['QUOTA_CHARGE', 'QUOTA_FEE'],
        'paid_by':           ['CONSIGNOR_NAME', 'B2B_NAME'],
        'paid_to':           ['QUOTA_AUTHORITY', 'ISSUING_AUTHORITY'],
        'signatory_title':   ['DESIGNATION', 'AUTH_ROLE'],
        'company_address':   ['CONSIGNOR_ADDRESS', 'B2B_ADDRESS'],
        'quota_included': ['QUOTA_INCLUDED'],
        'statement_date': ['STATEMENT_DATE']
    },
    'TSCA': {
        'company_name':      ['CONSIGNOR_NAME', 'B2B_NAME'],
        'company_address':   ['CONSIGNOR_ADDRESS', 'B2B_ADDRESS'],
        'authorized_name':   ['CONTACT_PERSON', 'AUTH_NAME'],
        'signatory_title':   ['DESIGNATION', 'AUTH_ROLE'],
        'awb_number':        ['AWB_NUMBER', 'AWB'],
        'certification_type': ['CERTIFICATION_TYPE']
    },
    'GR_SAMPLE': {
        'shipper_name':      ['CONSIGNOR_NAME', 'B2B_NAME'],
        'shipper_address':   ['CONSIGNOR_ADDRESS', 'B2B_ADDRESS'],
        'consignee_name':    ['CONSIGNEE_NAME'],
        'consignee_address': ['CONSIGNEE_ADDRESS'],
        'invoice_no':        ['REFERANCE', 'INVOICE_NO'],
        'invoice_date':      ['ORDER_DATE', 'DATE'],
        'description':       ['PRODUCT', 'CONTENT', 'DESC'],
        'bank_name': ['BANK_NAME'],
        'bank_address': ['BANK_ADDRESS'],
        'customs_authority': ['CUSTOMS_AUTHORITY'],
        'invoice_value': ['INVOICE_VALUE'],
        'bank_signatory': ['BANK_SIGNATORY'],
        'bank_designation': ['BANK_DESIGNATION']
    },
    'GR_REPAIR': {
        'company_name': ['COMPANY_NAME', 'CONSIGNOR_NAME'],
        'company_address': ['COMPANY_ADDRESS', 'CONSIGNOR_ADDRESS'],
        'bank_name': ['BANK_NAME'],
        'bank_address': ['BANK_ADDRESS'],
        'invoice_no': ['INVOICE_NUMBER', 'INVOICE_NO'],
        'invoice_date': ['INVOICE_DATE'],
        'invoice_value': ['INVOICE_VALUE', 'TOTAL_VALUE'],
        'awb_no': ['AWB_NUMBER', 'AWB_NO'],
        'awb_date': ['AWB_DATE'],
        'consignee_name': ['CONSIGNEE_NAME'],
        'consignee_address': ['CONSIGNEE_ADDRESS'],
        'destination_country': ['DESTINATION_COUNTRY', 'COUNTRY'],
        'goods_description': ['PRODUCT_DESCRIPTION', 'DESCRIPTION'],
        'return_reason': ['RETURN_REASON'],
        'certificate_date': ['CERTIFICATE_DATE'],
        'authorized_signatory': ['AUTHORIZED_SIGNATORY'],
        'customs_authority': ['CUSTOMS_AUTHORITY'],
        'bank_signatory': ['BANK_SIGNATORY'],
        'bank_designation': ['BANK_DESIGNATION']
    },
    // MSDS Document
    'MSDS': {
        'commodity_name': ['PRODUCT_DESCRIPTION', 'DESCRIPTION'],
        'shipping_name': ['PROPER_SHIPPING_NAME'],
        'preparation': ['PREPARATION_TYPE'],
        'manufacturer_name': ['MANUFACTURER_NAME', 'COMPANY_NAME'],
        'manufacturer_address': ['MANUFACTURER_ADDRESS', 'COMPANY_ADDRESS'],
        'emergency_tel': ['EMERGENCY_PHONE'],
        'chemical_name': ['CHEMICAL_NAME'],
        'chemical_formula': ['CHEMICAL_FORMULA'],
        'cas_number': ['CAS_NUMBER'],
        'index_number': ['INDEX_NUMBER'],
        'hazard_symbol': ['HAZARD_SYMBOL'],
        'risk_phrases': ['RISK_PHRASES'],
        'un_number': ['UN_NUMBER'],
        'physical_form': ['PHYSICAL_FORM'],
        'colour': ['COLOUR'],
        'odour': ['ODOUR'],
        'melting_point': ['MELTING_POINT'],
        'density': ['DENSITY'],
        'vapour_pressure': ['VAPOUR_PRESSURE'],
        'viscosity': ['VISCOSITY'],
        'water_solubility': ['WATER_SOLUBILITY'],
        'ph_value': ['PH_VALUE'],
        'flash_point': ['FLASH_POINT'],
        'ignition_temp': ['IGNITION_TEMPERATURE'],
        'explosive_limits': ['EXPLOSIVE_LIMITS'],
        'oral_toxicity': ['ORAL_TOXICITY_LD50'],
        'dermal_toxicity': ['DERMAL_TOXICITY_LD50'],
        'inhalation_toxicity': ['INHALATION_TOXICITY_LC50'],
        'transport_class': ['TRANSPORT_CLASS'],
        'packing_group': ['PACKING_GROUP']
    },
    // Domestic Tax Invoice
    'TAX_CHALLAN': {
        'challan_no': ['REFERANCE', 'INVOICE_NO', 'DOC_NUMBER'],
        'challan_date': ['ORDER_DATE', 'DATE', 'BOOKING_DATE'],
        'po_number': ['PO_NUMBER', 'BUYER_ORDER'],
        'po_date': ['PO_DATE'],
        'eway_bill': ['EWAY_BILL_NO'],
        'supplier_name': ['CONSIGNOR_NAME', 'COMPANY_NAME'],
        'supplier_address': ['CONSIGNOR_ADDRESS', 'COMPANY_ADDRESS'],
        'supplier_address_line1': ['CONSIGNOR_ADDRESS', 'COMPANY_ADDRESS'],
        'supplier_address_line2': ['CONSIGNOR_ADDRESS_2', 'COMPANY_ADDRESS_2'],
        'supplier_city': ['CONSIGNOR_CITY', 'COMPANY_CITY'],
        'supplier_state': ['CONSIGNOR_STATE', 'COMPANY_STATE'],
        'supplier_pincode': ['CONSIGNOR_PINCODE', 'COMPANY_PINCODE'],
        'supplier_country': ['CONSIGNOR_COUNTRY', 'COMPANY_COUNTRY'],
        'supplier_gstin': ['GSTIN', 'GST_NO'],
        'receiver_name': ['CONSIGNEE_NAME'],
        'receiver_address': ['CONSIGNEE_ADDRESS'],
        'receiver_address_line1': ['CONSIGNEE_ADDRESS'],
        'receiver_address_line2': ['CONSIGNEE_ADDRESS_2'],
        'receiver_city': ['CONSIGNEE_CITY'],
        'receiver_state': ['CONSIGNEE_STATE'],
        'receiver_pincode': ['CONSIGNEE_PINCODE'],
        'receiver_country': ['CONSIGNEE_COUNTRY'],
        'receiver_gstin': ['RECEIVER_GSTIN'],
        'receiver_gst_code': ['GST_CODE'],
        'transport_mode': ['MODE', 'TRANSPORT_MODE'],
        'vehicle_no': ['VEHICLE_NO', 'FLIGHT_NO'],
        'transporter': ['CARRIER', 'TRANSPORTER'],
        'lr_no': ['LR_NO', 'AWB_NUMBER'],
        'dispatch_date': ['DISPATCH_DATE', 'ORDER_DATE']
    },
    // Letter of Authority
    'LOA': {
        'exporter_name': ['CONSIGNOR_NAME', 'COMPANY_NAME'],
        'exporter_address': ['CONSIGNOR_ADDRESS', 'COMPANY_ADDRESS'],
        'iec_number': ['IEC', 'IEC_CODE'],
        'gstin': ['GSTIN', 'GST_NO'],
        'pan': ['PAN', 'PAN_NO'],
        'cha_name': ['CHA_NAME', 'FORWARDER'],
        'cha_license': ['CHA_LICENSE'],
        'shipping_bill_no': ['SB_NO', 'SHIPPING_BILL'],
        'invoice_no': ['REFERANCE', 'INVOICE_NO'],
        'vessel_flight': ['FLIGHT_NO', 'VESSEL_NO'],
        'port_loading': ['ORIGIN_CITY', 'FROM_CITY'],
        'valid_from': ['VALID_FROM', 'ORDER_DATE'],
        'valid_to': ['VALID_TO'],
        'signatory_name': ['CONTACT_PERSON', 'AUTH_NAME'],
        'signatory_designation': ['DESIGNATION', 'AUTH_ROLE'],
        'customs_authority': ['CUSTOMS_AUTHORITY']
    },
    // Delivery Challan & Packaging List
    'DELIVERY_CHALLAN': {
        'challan_no': ['REFERANCE', 'INVOICE_NO', 'DOC_NUMBER'],
        'challan_date': ['ORDER_DATE', 'DATE', 'BOOKING_DATE'],
        'from_company': ['CONSIGNOR_NAME', 'COMPANY_NAME'],
        'from_address': ['CONSIGNOR_ADDRESS', 'COMPANY_ADDRESS'],
        'to_company': ['CONSIGNEE_NAME'],
        'to_address': ['CONSIGNEE_ADDRESS'],
        'delivery_date': ['DELIVERY_DATE'],
        'vehicle_no': ['VEHICLE_NO', 'FLIGHT_NO'],
        'driver_name': ['DRIVER_NAME'],
        'special_instructions': ['REMARKS', 'INSTRUCTIONS', 'NOTE'],
        'packaging_notes': ['PACKAGING_NOTES']
    },
    // Certificate of Origin
    'COO': {
        'exporter_name': ['CONSIGNOR_NAME', 'COMPANY_NAME'],
        'exporter_address': ['CONSIGNOR_ADDRESS', 'COMPANY_ADDRESS'],
        'consignee_name': ['CONSIGNEE_NAME'],
        'consignee_address': ['CONSIGNEE_ADDRESS'],
        'departure_date': ['ORDER_DATE', 'DISPATCH_DATE'],
        'vessel_aircraft': ['FLIGHT_NO', 'VESSEL_NO'],
        'port_loading': ['ORIGIN_CITY', 'FROM_CITY'],
        'port_discharge': ['DESTINATION_CITY', 'TO_CITY'],
        'marks_numbers': ['MARKS', 'BOX_NO'],
        'description_goods': ['PRODUCT_DESCRIPTION', 'DESCRIPTION'],
        'gross_weight': ['GROSS_WEIGHT', 'WEIGHT'],
        'invoice_no': ['REFERANCE', 'INVOICE_NO'],
        'invoice_date': ['ORDER_DATE', 'INVOICE_DATE'],
        'country_origin': ['ORIGIN_COUNTRY', 'COUNTRY_OF_ORIGIN'],
        'country_destination': ['DESTINATION_COUNTRY', 'COUNTRY'],
        'transport_details':['MODE', 'CARRIER'],
        'marks_and_numbers':['MARKS', 'BOX_NO'],
        'country_of_origin':['ORIGIN_COUNTRY', 'COUNTRY_OF_ORIGIN', 'ORIGIN'],
        'origin_criterion': ['ORIGIN_CRITERION'],
        'number_packages': ['NUMBER_PACKAGES'],
        'certifying_authority': ['CERTIFYING_AUTHORITY'],
        'certification_date': ['CERTIFICATION_DATE'],
        'declaration_place': ['DECLARATION_PLACE']
    },
    // Annexure D for DEPB
    'ANN_D': {
        'shipping_bill_no': ['SB_NO', 'SHIPPING_BILL'],
        'shipping_bill_date': ['ORDER_DATE', 'DATE'],
        'exporter_name': ['CONSIGNOR_NAME', 'COMPANY_NAME'],
        'exporter_address': ['CONSIGNOR_ADDRESS', 'COMPANY_ADDRESS'],
        'excise_procedure': ['EXCISE_PROCEDURE'],
        'deec_status': ['DEEC_STATUS'],
        'declaration_date': ['ORDER_DATE', 'DATE']
    },
    'NON_DG': {
        'destination':      ['DESTINATION_CITY', 'DESTINATION', 'TO_CITY'],
        'description':      ['PRODUCT', 'CONTENT', 'DESC'],
        'mawb_number': ['MAWB_NUMBER'],
        'airport_departure': ['AIRPORT_DEPARTURE'],
        'airport_destination': ['AIRPORT_DESTINATION'],
        'total_packages': ['TOTAL_PACKAGES'],
        'net_weight': ['NET_WEIGHT'],
        'gross_weight': ['GROSS_WEIGHT'],
        'shipper_name': ['SHIPPER_NAME'],
        'shipper_address': ['SHIPPER_ADDRESS'],
        'signatory_designation': ['SIGNATORY_DESIGNATION']
    },
    'INS_CERT': {
        'policy_no': ['POLICY_NO'],
        'insured_amount':   ['DECLARED_VALUE', 'VALUE', 'AMOUNT'],
        'insured_party':    ['CONSIGNOR_NAME', 'EXPORTER'],
        'subject_matter':   ['PRODUCT', 'CONTENT']
    },
    'ARE1': {
        'are1_no': ['ARE1_NO'],
        'excise_reg_no': ['EXCISE_REG_NO'],
        'quantity':         ['PIECS', 'QTY', 'QUANTITY'],
        'value_for_excise': ['DECLARED_VALUE', 'VALUE'],
        'duty_involved': ['DUTY_INVOLVED'],
        'description_of_goods': ['PRODUCT', 'CONTENT']
    }
};

// ============================================================================
// SECTION 1: DOCUMENT SCHEMAS (CONFIGURATION)
// ============================================================================
const DOC_SCHEMAS = {
    // --- Category 1: Core Documents ---
    'COM_INV': {
        id: 'COM_INV',
        title: 'Commercial Invoice',
        desc: 'The primary document used by foreign customs for valuation, classification, and duty assessment. It acts as the legal bill of sale between buyer and seller, detailing the price, value, and quantity of goods sold.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { type: 'heading', label: 'Exporter Details' },
            { key: 'exporter_name', label: 'Exporter Name', type: 'text', required: true, width: 'w-full' },
            { key: 'exporter_address_line1', label: 'Address Line 1', type: 'text', required: true, width: 'w-full' },
            { key: 'exporter_address_line2', label: 'Address Line 2', type: 'text', width: 'w-full' },
            { key: 'exporter_city', label: 'City', type: 'text', required: true, width: 'w-1/3', api_populate: true },
            { key: 'exporter_state', label: 'State', type: 'text', required: true, width: 'w-1/3', api_populate: true },
            { key: 'exporter_pincode', label: 'Pincode', type: 'text', required: true, width: 'w-1/3', api_trigger: true, pattern: '[0-9]{6}' },
            { key: 'exporter_country', label: 'Country', type: 'text', value: 'INDIA', width: 'w-1/2', api_populate: true },
            { key: 'invoice_no', label: 'Invoice No.', type: 'text', required: true, width: 'w-1/3' },
            { key: 'invoice_date', label: 'Date', type: 'date', required: true, width: 'w-1/3' },
            { key: 'iec', label: 'IEC Code', type: 'text', width: 'w-1/3' },
            { key: 'exporter_ref', label: 'Exporter Reference', type: 'text', width: 'w-1/2' },
            { key: 'other_ref', label: 'Other References', type: 'text', width: 'w-1/2' },
            { key: 'buyer_order', label: 'Buyer Order No.', type: 'text', width: 'w-1/2' },
            { key: 'buyer_date', label: 'Order Date', type: 'date', width: 'w-1/2' },
            { type: 'heading', label: 'Consignee Details' },
            { key: 'consignee_name', label: 'Consignee Name', type: 'text', required: true, width: 'w-full' },
            { key: 'consignee_address_line1', label: 'Address Line 1', type: 'text', required: true, width: 'w-full' },
            { key: 'consignee_address_line2', label: 'Address Line 2', type: 'text', width: 'w-full' },
            { key: 'consignee_city', label: 'City', type: 'text', required: true, width: 'w-1/3', api_populate: true },
            { key: 'consignee_state', label: 'State/Province', type: 'text', width: 'w-1/3', api_populate: true },
            { key: 'consignee_pincode', label: 'Pincode/Zipcode', type: 'text', width: 'w-1/3', api_trigger: true },
            { key: 'consignee_country', label: 'Country', type: 'text', required: true, width: 'w-1/2', api_populate: true },
            { key: 'buyer_details', label: 'Buyer (if other than Consignee)', type: 'textarea', width: 'w-full' },
            { key: 'country_origin', label: 'Country of Origin', type: 'text', value: 'INDIA', width: 'w-1/2' },
            { key: 'country_dest', label: 'Country of Destination', type: 'text', required: true, width: 'w-1/2' },
            { type: 'heading', label: 'Logistics Details' },
            { key: 'pre_carriage', label: 'Pre-Carriage By', type: 'text', width: 'w-1/3' },
            { key: 'place_receipt', label: 'Place of Receipt', type: 'text', width: 'w-1/3' },
            { key: 'vessel_flight_no', label: 'Vessel / Flight No.', type: 'text', width: 'w-1/3' },
            { key: 'port_loading', label: 'Port of Loading', type: 'text', width: 'w-1/3' },
            { key: 'port_discharge', label: 'Port of Discharge', type: 'text', width: 'w-1/3' },
            { key: 'final_dest', label: 'Final Destination', type: 'text', width: 'w-1/3' },
            { type: 'heading', label: 'Commercial Terms' },
            { key: 'terms', label: 'Incoterms', type: 'select', options: ['FOB', 'CIF', 'C&F', 'EXW', 'DAP', 'DDP'], width: 'w-1/2' },
            { key: 'payment_terms', label: 'Payment Terms', type: 'select', options: ['DP', 'DA', 'AP', 'LC', 'TT'], width: 'w-1/2' },
            { type: 'heading', label: 'Currency & Product Details' },
            { key: 'currency', label: 'Target Currency', type: 'select', options: ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'AED'], width: 'w-1/2' },
            { key: 'exchange_rate', label: 'Exchange Rate (INR to Target)', type: 'number', width: 'w-1/2', placeholder: 'e.g. 84.50' },
            { key: 'items', label: 'Product List (Enter Values in INR)', type: 'items_table', width: 'w-full' },
            { key: 'declaration', label: 'Declaration', type: 'textarea', value: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', width: 'w-full' }
        ]
    },
    'PKL': {
        id: 'PKL',
        title: 'Packing List',
        desc: 'Required by customs and carriers to identify specific contents, weights, and dimensions of each package. It ensures safety during handling and allows officials to reconcile the cargo against the Commercial Invoice.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { type: 'heading', label: 'Exporter Details' },
            { key: 'exporter_name', label: 'Exporter Name', type: 'text', required: true, width: 'w-full' },
            { key: 'exporter_address_line1', label: 'Address Line 1', type: 'text', required: true, width: 'w-full' },
            { key: 'exporter_address_line2', label: 'Address Line 2', type: 'text', width: 'w-full' },
            { key: 'exporter_city', label: 'City', type: 'text', required: true, width: 'w-1/3', api_populate: true },
            { key: 'exporter_state', label: 'State', type: 'text', required: true, width: 'w-1/3', api_populate: true },
            { key: 'exporter_pincode', label: 'Pincode', type: 'text', required: true, width: 'w-1/3', api_trigger: true, pattern: '[0-9]{6}' },
            { key: 'exporter_country', label: 'Country', type: 'text', value: 'INDIA', width: 'w-1/2', api_populate: true },
            { type: 'heading', label: 'Consignee Details' },
            { key: 'consignee_name', label: 'Consignee Name', type: 'text', required: true, width: 'w-full' },
            { key: 'consignee_address_line1', label: 'Address Line 1', type: 'text', required: true, width: 'w-full' },
            { key: 'consignee_address_line2', label: 'Address Line 2', type: 'text', width: 'w-full' },
            { key: 'consignee_city', label: 'City', type: 'text', required: true, width: 'w-1/3', api_populate: true },
            { key: 'consignee_state', label: 'State/Province', type: 'text', width: 'w-1/3', api_populate: true },
            { key: 'consignee_pincode', label: 'Pincode/Zipcode', type: 'text', width: 'w-1/3', api_trigger: true },
            { key: 'consignee_country', label: 'Country', type: 'text', required: true, width: 'w-1/2', api_populate: true },
            { key: 'invoice_no', label: 'Invoice No.', type: 'text', width: 'w-1/3' },
            { key: 'invoice_date', label: 'Invoice Date', type: 'date', width: 'w-1/3' },
            { key: 'buyer_order', label: 'Buyer Order No.', type: 'text', width: 'w-1/3' },
            { type: 'heading', label: 'Logistics' },
            { key: 'vessel_flight', label: 'Vessel / Flight', type: 'text', width: 'w-1/3' },
            { key: 'port_loading', label: 'Port of Loading', type: 'text', width: 'w-1/3' },
            { key: 'port_discharge', label: 'Port of Discharge', type: 'text', width: 'w-1/3' },
            { key: 'final_dest', label: 'Final Destination', type: 'text', width: 'w-1/3' },
            { type: 'heading', label: 'Packing Details' },
            { key: 'packing_list', label: 'Packages', type: 'packing_table', width: 'w-full' },
            { type: 'heading', label: 'Other Info' },
            { key: 'marks_numbers', label: 'Marks & Numbers', type: 'textarea', width: 'w-1/2' },
            { key: 'special_instructions', label: 'Special Instructions', type: 'textarea', width: 'w-1/2' }
        ]
    },
    'KYC': {
        id: 'KYC',
        title: 'KYC Form',
        desc: 'Mandatory verification document for Indian Customs to establish the identity and address of the exporter/importer. It is required to prevent fraud, ensure regulatory compliance, and link the IEC/PAN to the shipment.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'entity_type', label: 'Category / Entity Type', type: 'select', options: ['Individual/Proprietary firm', 'Company', 'Trusts/Foundations', 'Partnership firm'], required: true, width: 'w-full' },
            { key: 'entity_name', label: 'Entity Name (and partners, if applicable)', type: 'text', required: true, width: 'w-full' },
            { type: 'heading', label: 'Permanent / Registered Address' },
            { key: 'permanent_address_line1', label: 'Address Line 1', type: 'text', required: true, width: 'w-full' },
            { key: 'permanent_address_line2', label: 'Address Line 2', type: 'text', width: 'w-full' },
            { key: 'permanent_city', label: 'City', type: 'text', required: true, width: 'w-1/3', api_populate: true },
            { key: 'permanent_state', label: 'State', type: 'text', required: true, width: 'w-1/3', api_populate: true },
            { key: 'permanent_pincode', label: 'Pincode', type: 'text', required: true, width: 'w-1/3', api_trigger: true, pattern: '[0-9]{6}' },
            { key: 'permanent_country', label: 'Country', type: 'text', value: 'INDIA', width: 'w-full', api_populate: true },
            { type: 'heading', label: 'Principal Business Address' },
            { key: 'business_address_line1', label: 'Address Line 1', type: 'text', required: true, width: 'w-full' },
            { key: 'business_address_line2', label: 'Address Line 2', type: 'text', width: 'w-full' },
            { key: 'business_city', label: 'City', type: 'text', required: true, width: 'w-1/3', api_populate: true },
            { key: 'business_state', label: 'State', type: 'text', required: true, width: 'w-1/3', api_populate: true },
            { key: 'business_pincode', label: 'Pincode', type: 'text', required: true, width: 'w-1/3', api_trigger: true, pattern: '[0-9]{6}' },
            { key: 'business_country', label: 'Country', type: 'text', value: 'INDIA', width: 'w-full', api_populate: true },
            { key: 'auth_signatories', label: 'Authorized Signatories (Names)', type: 'textarea', required: true, width: 'w-full', placeholder: 'e.g., 1. Mr. Rajesh Sharma\n2. Ms. Priya Patel' },
            { key: 'iec_no', label: 'IEC Number', type: 'text', required: true, width: 'w-1/2' },
            { key: 'pan', label: 'PAN Number', type: 'text', required: true, width: 'w-1/2' },

            { type: 'heading', label: 'Declaration & Signature Details' },

            { key: 'declaration_text', label: 'Declaration', type: 'textarea', value: 'I/We hereby declare that the particulars given herein above are true, correct and complete to the best of my/our knowledge and belief, the documents submitted in support of this Form KYC are genuine and obtained legally from the respective issuing authority. In case of any change in any of the aforementioned particulars, I/we undertake to notify you in writing failing which the above particulars may be relied upon including all shipments/documents executed and tendered by the individual so authorized and mentioned in 6 above. I/we hereby authorize you to submit the above particulars to the customs and other regulatory authorities on my/our behalf as may be required in order to transport and customs clear my/our shipments.', width: 'w-full', required: true },

            { key: 'authorized_signatory_name', label: 'Signing Authority Name', type: 'text', required: true, width: 'w-1/2' },
            { key: 'authorized_signatory_designation', label: 'Signing Authority Designation', type: 'text', required: true, width: 'w-1/2' },
            { key: 'declaration_place', label: 'Place of Declaration', type: 'text', required: true, width: 'w-1/2' },
            { key: 'declaration_date', label: 'Date of Declaration', type: 'date', required: true, width: 'w-1/2' }
        ]
    },
    'SLI': {
        id: 'SLI',
        title: 'Shippers Letter of Instructions',
        desc: 'Formal instructions from the exporter to the freight forwarder detailing shipment handling, routing, and documentation requirements. It ensures the Forwarder issues the Air Waybill or Bill of Lading correctly.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'shipper_name', label: 'Shipper Name', type: 'text', required: true, width: 'w-1/2' },
            { key: 'consignee_name', label: 'Consignee Name', type: 'text', required: true, width: 'w-1/2' },
            { key: 'invoice_no', label: 'Invoice No', type: 'text', required: true, width: 'w-1/2' },
            { key: 'sli_date', label: 'Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'e_code', label: 'E Code No (10 Digit)', type: 'text', width: 'w-1/2' },
            { key: 'bank_ad_code', label: 'Bank AD Code', type: 'text', width: 'w-1/2' },
            { key: 'currency', label: 'Currency of Invoice', type: 'select', options: ['USD', 'EUR', 'GBP', 'INR'], width: 'w-1/3' },
            { key: 'incoterms', label: 'Incoterms', type: 'select', options: ['FOB', 'C&F', 'C&I', 'CIF'], width: 'w-1/3' },
            { key: 'payment_terms', label: 'Nature of Payment', type: 'select', options: ['DP', 'DA', 'AP', 'OTHERS'], width: 'w-1/3' },
            { type: 'heading', label: 'Shipping Bill Details' },
            { key: 'invoice_value', label: 'For Value', type: 'number', width: 'w-1/2' },
            { key: 'freight', label: 'Freight (if any)', type: 'number', width: 'w-1/2' },
            { key: 'insurance', label: 'Insurance (if any)', type: 'number', width: 'w-1/2' },
            { key: 'commission', label: 'Commission (if any)', type: 'number', width: 'w-1/2' },
            { key: 'discount', label: 'Discount (if any)', type: 'number', width: 'w-1/2' },
            { key: 'no_of_pkgs', label: 'No. of Packages', type: 'text', width: 'w-1/2' },
            { key: 'net_weight', label: 'Net Weight (KGS)', type: 'number', width: 'w-1/3' },
            { key: 'gross_weight', label: 'Gross Weight (KGS)', type: 'number', width: 'w-1/3' },
            { key: 'volume_weight', label: 'Volume Weight (KGS)', type: 'number', width: 'w-1/3' },
            { key: 'forwarder_name', label: 'Freight Forwarder', type: 'text', required: true, width: 'w-full' },
            { key: 'special_instructions', label: 'Special Instructions', type: 'textarea', width: 'w-full' }
        ]
    },
    'BL_AWB': {
        id: 'BL_AWB',
        title: 'Bill of Lading / Air Waybill',
        desc: 'Acts as a receipt for cargo, a contract of carriage between shipper and carrier, and (in the case of a B/L) a document of title required to claim possession of the goods at the destination.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'exporter_details', label: 'Exporter (Name & Address)', type: 'textarea', required: true, width: 'w-full' },
            { key: 'consignee_details', label: 'Consignee (Name & Address)', type: 'textarea', required: true, width: 'w-full' },
            { key: 'carrier_name', label: 'Carrier Name', type: 'text', required: true, width: 'w-full' },
            { key: 'awb_number', label: 'B/L or AWB Number', type: 'text', required: true, width: 'w-1/2' },
            { key: 'invoice_no', label: 'Invoice Number', type: 'text', width: 'w-1/2' },
            { key: 'invoice_date', label: 'Invoice Date', type: 'date', width: 'w-1/2' },
            { key: 'port_of_loading', label: 'Port of Loading', type: 'text', width: 'w-1/2' },
            { key: 'port_of_discharge', label: 'Port of Discharge', type: 'text', width: 'w-1/2' },
            { key: 'vessel_flight_no', label: 'Vessel / Flight No.', type: 'text', width: 'w-1/2' },
            { key: 'country_dest', label: 'Country of Destination', type: 'text', width: 'w-1/2' },
            { key: 'description_of_goods', label: 'Description of Goods', type: 'textarea', width: 'w-full' }
        ]
    },
    'INS_CERT': {
        id: 'INS_CERT',
        title: 'Insurance Certificate',
        desc: 'Provides proof that the shipment is insured against loss or damage during transit. It is often required by the buyer under specific Incoterms (like CIF) or by banks for Letter of Credit compliance.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'exporter_details', label: 'Exporter (Name & Address)', type: 'textarea', required: true, width: 'w-full' },
            { key: 'consignee_details', label: 'Consignee (Name & Address)', type: 'textarea', required: true, width: 'w-full' },
            { key: 'invoice_no', label: 'Invoice Number', type: 'text', width: 'w-1/2' },
            { key: 'invoice_date', label: 'Invoice Date', type: 'date', width: 'w-1/2' },
            { key: 'awb_number', label: 'AWB/B/L Number', type: 'text', width: 'w-1/2' },
            { key: 'policy_no', label: 'Policy Number', type: 'text', required: true, width: 'w-1/2' },
            { key: 'insured_amount', label: 'Insured Amount', type: 'number', required: true, width: 'w-1/2' },
            { key: 'insured_party', label: 'Insured Party', type: 'text', width: 'w-1/2' },
            { key: 'subject_matter', label: 'Subject Matter Insured', type: 'text', width: 'w-full' },
            { key: 'country_dest', label: 'Country of Destination', type: 'text', width: 'w-1/2' },
            { key: 'description_of_goods', label: 'Description of Goods', type: 'textarea', width: 'w-full' }
        ]
    },
    'LOA': {
        id: 'LOA',
        title: 'Letter of Authority',
        desc: 'Legally authorizes a Customs House Agent (CHA) to act on behalf of the exporter/importer. It allows the agent to file documents and clear shipments with Customs authorities.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'exporter_details', label: 'Exporter Name & Address', type: 'textarea', required: true, width: 'w-full' },
            { key: 'cha_name', label: 'CHA Name & Address', type: 'textarea', required: true, width: 'w-full' },
            { key: 'validity_period', label: 'Validity Period', type: 'text', width: 'w-1/2' },
            { key: 'authorized_signatory', label: 'Authorized Signatory', type: 'text', width: 'w-1/2' }
        ]
    },

    // --- Category 2: Incentives & Regimes ---
    'ANN_D': {
        id: 'ANN_D',
        title: 'Annexure D for DEPB',
        desc: 'DEPB Declaration required for claims under the Duty Entitlement Pass Book scheme.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'shipping_bill_no', label: 'Shipping Bill Number', type: 'text', required: true, width: 'w-1/2' },
            { key: 'shipping_bill_date', label: 'Shipping Bill Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'exporter_name', label: 'Exporter Name', type: 'text', required: true, width: 'w-full' },
            { key: 'exporter_address', label: 'Exporter Address', type: 'textarea', required: true, width: 'w-full' },
            { type: 'heading', label: 'Declaration Options' },
            { key: 'excise_procedure', label: 'Central Excise Procedure', type: 'select', options: ['Not availed', 'Availed under rule 12(1)(b)/13(1)(b)'], width: 'w-full' },
            { key: 'deec_status', label: 'DEEC Status', type: 'select', options: ['Not under DEEC', 'Under DEEC - Central Excise only', 'Under DEEC - Brand rate'], width: 'w-full' },
            { key: 'declaration_date', label: 'Declaration Date', type: 'date', required: true, width: 'w-1/2' }
        ]
    },
    'ARE1': {
        id: 'ARE1',
        title: 'ARE-1 Form',
        desc: 'Used to claim rebates on excise duty or remove goods for export without payment of duty (under bond/LUT). It serves as official proof of export for Central Excise authorities.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'exporter_details', label: 'Exporter (Name & Address)', type: 'textarea', required: true, width: 'w-full' },
            { key: 'consignee_details', label: 'Consignee (Name & Address)', type: 'textarea', width: 'w-full' },
            { key: 'invoice_no', label: 'Invoice Number', type: 'text', width: 'w-1/2' },
            { key: 'invoice_date', label: 'Invoice Date', type: 'date', width: 'w-1/2' },
            { key: 'are1_no', label: 'ARE-1 Number', type: 'text', required: true, width: 'w-1/2' },
            { key: 'excise_reg_no', label: 'Central Excise Reg. No.', type: 'text', required: true, width: 'w-1/2' },
            { key: 'description_of_goods', label: 'Description of Goods', type: 'textarea', width: 'w-full' },
            { key: 'quantity', label: 'Quantity', type: 'number', width: 'w-1/3' },
            { key: 'value_for_excise', label: 'Value for Excise Duty', type: 'number', width: 'w-1/3' },
            { key: 'duty_involved', label: 'Duty Involved', type: 'number', width: 'w-1/3' },
            { key: 'country_dest', label: 'Country of Destination', type: 'text', width: 'w-1/2' },
            { key: 'awb_number', label: 'AWB/B/L Number', type: 'text', width: 'w-1/2' }
        ]
    },

    // --- Category 3: Shipment Type ---
    'SDF': {
        id: 'SDF',
        title: 'SDF Form',
        desc: 'Statutory Declaration Form required by RBI/FEMA to declare the full export value and guarantee that foreign exchange will be repatriated to India within the stipulated time frame.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'shipping_bill_no', label: 'Shipping Bill No', type: 'text', required: true, width: 'w-1/2' },
            { key: 'shipping_bill_date', label: 'Shipping Bill Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'seller_consignor', label: 'Declaration Type', type: 'select', options: ['SELLER', 'CONSIGNOR'], value: 'SELLER', width: 'w-1/2' },
            { key: 'value_ascertainment', label: 'Value Ascertainment', type: 'select', options: ['A - Value as contracted', 'B - Value not ascertainable'], value: 'B - Value not ascertainable', width: 'w-1/2' },
            { key: 'bank_name', label: 'Bank Name', type: 'text', required: true, width: 'w-full' },
            { key: 'repatriation_date', label: 'Repatriation Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'rbi_caution_list', label: 'RBI Caution List Status', type: 'select', options: ['am/are not', 'am/are'], value: 'am/are not', width: 'w-1/2' },
            { key: 'exporter_name', label: 'Exporter Name', type: 'text', required: true, width: 'w-full' },
            { key: 'declaration_date', label: 'Declaration Date', type: 'date', required: true, width: 'w-1/2' }
        ]
    },
    'ANN_1': {
        id: 'ANN_1',
        title: 'Annexure-I for Drawback',
        desc: 'Exporters Declaration required for Exports of Woven Garments for availing higher All Industry Rate of Drawback.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'goods_description', label: 'Description of the Goods', type: 'text', required: true, width: 'w-full' },
            { key: 'invoice_no', label: 'Invoice No.', type: 'text', required: true, width: 'w-1/2' },
            { key: 'invoice_date', label: 'Invoice Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'exporter_name', label: 'Exporter Name', type: 'text', required: true, width: 'w-full' },
            { key: 'exporter_address', label: 'Exporter Address with Central Excise Details', type: 'textarea', required: true, width: 'w-full' },
            { key: 'manufacturer_address', label: 'Manufacturer Address with Central Excise Details', type: 'textarea', width: 'w-full' },
            { key: 'manufacturing_unit_address', label: 'Manufacturing Unit Address', type: 'text', width: 'w-full' },
            { key: 'declaration_date', label: 'Declaration Date', type: 'date', required: true, width: 'w-1/2' }
        ]
    },
    'ANN_2': {
        id: 'ANN_2',
        title: 'Annexure-II for Drawback',
        desc: 'Supporting Manufacturers/Job Workers Declaration required for Exports of Woven Garments for availing higher All Industry Rate of Drawback.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'goods_description', label: 'Description of the Goods', type: 'text', required: true, width: 'w-full' },
            { key: 'invoice_no', label: 'Invoice No.', type: 'text', required: true, width: 'w-1/2' },
            { key: 'invoice_date', label: 'Invoice Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'exporter_name', label: 'Exporter Name', type: 'text', required: true, width: 'w-full' },
            { key: 'exporter_address', label: 'Exporter Address with Central Excise Details', type: 'textarea', width: 'w-full' },
            { key: 'manufacturer_name', label: 'Supporting Manufacturer/Job Worker Name', type: 'text', required: true, width: 'w-full' },
            { key: 'manufacturer_address', label: 'Manufacturer Address with Central Excise Details', type: 'textarea', required: true, width: 'w-full' },
            { key: 'manufacturing_unit_address', label: 'Manufacturing Unit Address', type: 'text', width: 'w-full' },
            { key: 'declaration_date', label: 'Declaration Date', type: 'date', required: true, width: 'w-1/2' }
        ]
    },
    'APP_3': {
        id: 'APP_3',
        title: 'Appendix III for Drawback',
        desc: 'Declaration form to be filled for export goods under claim for drawback.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'shipping_bill_no', label: 'Shipping Bill No', type: 'text', required: true, width: 'w-1/2' },
            { key: 'shipping_bill_date', label: 'Shipping Bill Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'exporter_name', label: 'Exporter Name', type: 'text', required: true, width: 'w-full' },
            { key: 'excise_procedure', label: 'Central Excise Procedure', type: 'select', options: ['Not availed', 'Availed under rule 191A/191B'], width: 'w-full' },
            { key: 'deec_status', label: 'DEEC Status', type: 'select', options: ['Not under DEEC', 'Under DEEC'], width: 'w-full' },
            { key: 'declaration_date', label: 'Declaration Date', type: 'date', required: true, width: 'w-1/2' }
        ]
    },
    'APP_4': {
        id: 'APP_4',
        title: 'Appendix IV for Drawback',
        desc: 'Declaration for goods claiming drawback under specific S.S.Nos with CENVAT facility certification.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'shipping_bill_no', label: 'Shipping Bill No', type: 'text', required: true, width: 'w-1/2' },
            { key: 'shipping_bill_date', label: 'Shipping Bill Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'exporter_name', label: 'Exporter Name', type: 'text', required: true, width: 'w-full' },
            { key: 'exporter_address', label: 'Exporter Address', type: 'textarea', required: true, width: 'w-full' },
            { key: 'superintendent_name', label: 'Superintendent Name', type: 'text', width: 'w-1/2' },
            { key: 'excise_range', label: 'Central Excise Range/Division/Commissionerate', type: 'text', width: 'w-1/2' }
        ]
    },
    'APP_2': {
        id: 'APP_2',
        title: 'Appendix II for DEEC',
        desc: 'DEEC Declaration required for exports under the Advance License (DEEC) scheme.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'shipping_bill_no', label: 'Shipping Bill No', type: 'text', required: true, width: 'w-1/2' },
            { key: 'shipping_bill_date', label: 'Shipping Bill Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'exporter_name', label: 'Exporter Name', type: 'text', required: true, width: 'w-full' },
            { key: 'excise_procedure', label: 'Central Excise Procedure', type: 'select', options: ['Not availed', 'Availed except notification 49/94-CE', 'Availed under rule 12(I)(b)/13(I)(b)'], width: 'w-full' },
            { key: 'export_type', label: 'Export Type', type: 'select', options: ['Direct by license holder', 'By third party'], width: 'w-full' }
        ]
    },
    'ANN_C1': {
        id: 'ANN_C1',
        title: 'Annexure C1 for EOU',
        desc: 'Mandatory certificate for 100% Export Oriented Units (EOU) from Central Excise authorities.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'range', label: 'Range', type: 'text', width: 'w-1/3' },
            { key: 'division', label: 'Division', type: 'text', width: 'w-1/3' },
            { key: 'commissionerate', label: 'Commissionerate', type: 'text', width: 'w-1/3' },
            { key: 'certificate_no', label: 'Certificate No', type: 'text', width: 'w-1/2' },
            { key: 'certificate_date', label: 'Certificate Date', type: 'date', width: 'w-1/2' },
            { key: 'shipping_bill_no', label: 'Shipping Bill No', type: 'text', required: true, width: 'w-1/2' },
            { key: 'shipping_bill_date', label: 'Shipping Bill Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'eou_name', label: 'Name of EOU', type: 'text', required: true, width: 'w-full' },
            { key: 'iec_no', label: 'IEC No (of the EOU)', type: 'text', required: true, width: 'w-1/2' },
            { key: 'factory_address', label: 'Factory Address', type: 'textarea', required: true, width: 'w-full' },
            { key: 'examination_date', label: 'Date of Examination', type: 'date', width: 'w-1/2' },
            { key: 'examining_officer', label: 'Examining Officer Name & Designation', type: 'text', width: 'w-full' },
            { key: 'supervising_officer', label: 'Supervising Officer Name & Designation', type: 'text', width: 'w-full' },
            { key: 'location_code', label: 'Location Code', type: 'text', width: 'w-1/2' },
            { key: 'invoice_no', label: 'Export Invoice No', type: 'text', width: 'w-1/2' },
            { key: 'total_packages', label: 'Total No of Packages', type: 'number', width: 'w-1/2' },
            { key: 'consignee_name', label: 'Name & Address of Consignee Abroad', type: 'textarea', width: 'w-full' },
            { key: 'goods_description_correct', label: 'Is goods description correct?', type: 'select', options: ['Yes', 'No'], width: 'w-1/2' },
            { key: 'sample_drawn', label: 'Sample drawn for port?', type: 'select', options: ['Yes', 'No'], width: 'w-1/2' },
            { key: 'seal_details', label: 'Seal Details (Non-containerized)', type: 'text', width: 'w-full' },
            { key: 'container_details', label: 'Container Details (if applicable)', type: 'text', width: 'w-full' }
        ]
    },
    'SCD': {
        id: 'SCD',
        title: 'Single Country Declaration',
        desc: 'For goods wholly produced in one country (often required for US imports).',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'declarant_name', label: 'Declarant Name', type: 'text', required: true, width: 'w-full' },
            { key: 'country_origin', label: 'Country of Origin', type: 'text', value: 'INDIA', required: true, width: 'w-1/2' },
            { key: 'country_b', label: 'Country B (if applicable)', type: 'text', width: 'w-1/2' },
            { key: 'country_c', label: 'Country C (if applicable)', type: 'text', width: 'w-1/2' },
            { key: 'country_d', label: 'Country D (if applicable)', type: 'text', width: 'w-1/2' },
            { key: 'marks_numbers', label: 'Marks of Identification Numbers', type: 'textarea', width: 'w-full' },
            { key: 'description_goods', label: 'Description of Articles & Quantity', type: 'textarea', required: true, width: 'w-full' },
            { key: 'exportation_date', label: 'Date of Exportation', type: 'date', required: true, width: 'w-1/2' },
            { key: 'made_in_country', label: 'Made in Country', type: 'text', value: 'INDIA', width: 'w-1/2' },
            { key: 'declaration_date', label: 'Declaration Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'signatory_name', label: 'Signatory Name', type: 'text', required: true, width: 'w-1/2' },
            { key: 'signatory_title', label: 'Signatory Title', type: 'text', width: 'w-1/2' },
            { key: 'company_name', label: 'Company Name', type: 'text', required: true, width: 'w-1/2' },
            { key: 'company_address', label: 'Company Address', type: 'textarea', width: 'w-full' }
        ]
    },
    'MCD': {
        id: 'MCD',
        title: 'Multiple Country Declaration',
        desc: 'For goods assembled across multiple countries (often required for US textile imports).',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'declarant_name', label: 'Declarant Name', type: 'text', required: true, width: 'w-full' },
            { key: 'country_a', label: 'Country A', type: 'text', value: 'INDIA', required: true, width: 'w-1/4' },
            { key: 'country_b', label: 'Country B', type: 'text', width: 'w-1/4' },
            { key: 'country_c', label: 'Country C', type: 'text', width: 'w-1/4' },
            { key: 'country_d', label: 'Country D', type: 'text', width: 'w-1/4' },
            { key: 'items', label: 'Textile Items Details', type: 'mcd_table', width: 'w-full' },
            { key: 'signatory_name', label: 'Signatory Name', type: 'text', required: true, width: 'w-1/2' },
            { key: 'signatory_title', label: 'Signatory Title', type: 'text', width: 'w-1/2' },
            { key: 'company_name', label: 'Company Name', type: 'text', required: true, width: 'w-1/2' },
            { key: 'company_address', label: 'Company Address', type: 'textarea', width: 'w-full' },
            { key: 'declaration_date', label: 'Declaration Date', type: 'date', required: true, width: 'w-1/2' }
        ]
    },
    'NEG_DEC': {
        id: 'NEG_DEC',
        title: 'Negative Declaration',
        desc: 'Required for Silk products (>70% silk) exported to the USA.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'declarant_name', label: 'Declarant Name', type: 'text', required: true, width: 'w-full' },
            { key: 'items', label: 'Silk Products Details', type: 'neg_table', width: 'w-full' },
            { key: 'declaration_date', label: 'Declaration Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'signatory_name', label: 'Signatory Name', type: 'text', required: true, width: 'w-1/2' },
            { key: 'signatory_title', label: 'Signatory Title', type: 'text', width: 'w-1/2' },
            { key: 'company_name', label: 'Company Name', type: 'text', required: true, width: 'w-1/2' },
            { key: 'company_address', label: 'Company Address', type: 'textarea', width: 'w-full' }
        ]
    },
    'QUOTA': {
        id: 'QUOTA',
        title: 'Quota Charge Statement',
        desc: 'Required for textile exports subject to quota charges.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'company_name', label: 'Company Name', type: 'text', required: true, width: 'w-full' },
            { key: 'invoice_no', label: 'Invoice Number', type: 'text', required: true, width: 'w-1/2' },
            { key: 'invoice_date', label: 'Invoice Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'quota_amount', label: 'Quota Charge Amount', type: 'text', required: true, width: 'w-1/2', placeholder: 'USD 2,500.00' },
            { key: 'paid_by', label: 'Paid By', type: 'text', required: true, width: 'w-1/2' },
            { key: 'paid_to', label: 'Paid To (Quota Authority)', type: 'text', required: true, width: 'w-full' },
            { key: 'quota_included', label: 'Quota charge included in invoice price?', type: 'select', options: ['Yes', 'No'], width: 'w-1/2' },
            { key: 'statement_date', label: 'Statement Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'signatory_title', label: 'Signatory Title', type: 'text', width: 'w-1/2' },
            { key: 'company_address', label: 'Company Address', type: 'textarea', width: 'w-full' }
        ]
    },
    'TSCA': {
        id: 'TSCA',
        title: 'TSCA Certificate',
        desc: 'Required for chemical shipments to the USA.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'certification_type', label: 'Certification Type', type: 'select', options: ['Positive Certification', 'Negative Certification'], width: 'w-full' },
            { key: 'company_name', label: 'Company Name', type: 'text', required: true, width: 'w-full' },
            { key: 'company_address', label: 'Company Address', type: 'textarea', required: true, width: 'w-full' },
            { key: 'authorized_name', label: 'Authorized Name', type: 'text', required: true, width: 'w-1/2' },
            { key: 'signatory_title', label: 'Title', type: 'text', width: 'w-1/2' },
            { key: 'awb_number', label: 'Air Waybill Number', type: 'text', width: 'w-1/2' },
            { key: 'certificate_date', label: 'Certificate Date', type: 'date', required: true, width: 'w-1/2' }
        ]
    },
    'GR_SAMPLE': {
        id: 'GR_SAMPLE',
        title: 'GR Waiver (Free Sample)',
        desc: 'For commercial samples with no commercial value.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'bank_name', label: 'Bank Name', type: 'text', value: 'STATE BANK OF INDIA', width: 'w-full' },
            { key: 'bank_address', label: 'Bank Address', type: 'textarea', value: 'International Banking Division, Fort Branch, Mumbai - 400001', width: 'w-full' },
            { key: 'customs_authority', label: 'Customs Authority', type: 'text', value: 'The Commissioner of Customs, Mumbai', width: 'w-full' },
            { key: 'certificate_date', label: 'Certificate Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'shipper_name', label: 'Shipper Name & Address', type: 'textarea', required: true, width: 'w-full' },
            { key: 'consignee_name', label: 'Consignee Name & Address', type: 'textarea', required: true, width: 'w-full' },
            { key: 'description', label: 'Description with Model/Serial/Part Number', type: 'textarea', required: true, width: 'w-full' },
            { key: 'invoice_no', label: 'Invoice Number', type: 'text', required: true, width: 'w-1/2' },
            { key: 'invoice_date', label: 'Invoice Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'invoice_value', label: 'Value of Goods', type: 'text', value: 'USD 1.00 (NOMINAL)', width: 'w-1/2' },
            { key: 'bank_signatory', label: 'Bank Signatory Name', type: 'text', width: 'w-1/2' },
            { key: 'bank_designation', label: 'Bank Signatory Designation', type: 'text', width: 'w-1/2' }
        ]
    },
    'GR_REPAIR': {
        id: 'GR_REPAIR',
        title: 'GR Waiver (Repair & Return)',
        desc: 'For goods exported for repair and subsequent re-import.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'bank_name', label: 'Bank Name', type: 'text', value: 'STATE BANK OF INDIA', width: 'w-full' },
            { key: 'bank_address', label: 'Bank Address', type: 'textarea', value: 'International Banking Division, Fort Branch, Mumbai - 400001', width: 'w-full' },
            { key: 'customs_authority', label: 'Customs Authority', type: 'text', value: 'The Commissioner of Customs, Mumbai', width: 'w-full' },
            { key: 'certificate_date', label: 'Certificate Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'shipper_name', label: 'Shipper Name & Address', type: 'textarea', required: true, width: 'w-full' },
            { key: 'consignee_name', label: 'Consignee Name & Address', type: 'textarea', required: true, width: 'w-full' },
            { key: 'description', label: 'Description with Model/Serial/Part Number', type: 'textarea', required: true, width: 'w-full' },
            { key: 'invoice_no', label: 'Invoice Number', type: 'text', required: true, width: 'w-1/2' },
            { key: 'invoice_date', label: 'Invoice Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'invoice_value', label: 'Value of Goods', type: 'text', required: true, width: 'w-1/2' },
            { key: 'repair_reason', label: 'Reason for Repair', type: 'text', value: 'REPAIR AND RE-IMPORT AFTER REPAIR', width: 'w-1/2' },
            { key: 'bank_signatory', label: 'Bank Signatory Name', type: 'text', width: 'w-1/2' },
            { key: 'bank_designation', label: 'Bank Signatory Designation', type: 'text', width: 'w-1/2' }
        ]
    },
    'MSDS': {
        id: 'MSDS',
        title: 'MSDS (Material Safety Data Sheet)',
        desc: 'Required for chemical shipments containing 16 mandatory safety data points as per international regulations.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { type: 'heading', label: '1. Identification of Substance/Preparation & Company' },
            { key: 'commodity_name', label: 'Name of Commodity & Proper Shipping Name', type: 'text', required: true, width: 'w-full' },
            { key: 'preparation', label: 'Preparation', type: 'text', width: 'w-1/2' },
            { key: 'manufacturer_name', label: 'Manufacturing Company Name', type: 'text', required: true, width: 'w-1/2' },
            { key: 'manufacturer_address', label: 'Manufacturer Address & Emergency Tel', type: 'textarea', required: true, width: 'w-full' },
            { type: 'heading', label: '2. Composition/Information on Ingredients' },
            { key: 'chemical_name', label: 'Chemical Name & Family', type: 'text', width: 'w-1/2' },
            { key: 'chemical_formula', label: 'Chemical Formula & CAS Number', type: 'text', width: 'w-1/2' },
            { key: 'index_number', label: 'Index Number & Hazard Symbol', type: 'text', width: 'w-1/2' },
            { key: 'risk_phrases', label: 'Risk Phrases & UN Number', type: 'text', width: 'w-1/2' },
            { type: 'heading', label: '9. Physical & Chemical Properties' },
            { key: 'physical_form', label: 'Physical Form, Colour, Odour', type: 'text', width: 'w-full' },
            { key: 'melting_point', label: 'Melting Point, Density, Vapour Pressure, Viscosity', type: 'text', width: 'w-full' },
            { key: 'water_solubility', label: 'Solubility in Water & pH Value', type: 'text', width: 'w-1/2' },
            { key: 'flash_point', label: 'Flash Point, Ignition Temp, Explosive Limits', type: 'text', width: 'w-1/2' },
            { type: 'heading', label: '11. Toxicological Information' },
            { key: 'oral_toxicity', label: 'Oral Toxicity LD50 mg/kg', type: 'text', width: 'w-1/3' },
            { key: 'dermal_toxicity', label: 'Dermal Toxicity LD50 mg/kg', type: 'text', width: 'w-1/3' },
            { key: 'inhalation_toxicity', label: 'Inhalation Toxicity LC50 mg/kg', type: 'text', width: 'w-1/3' },
            { type: 'heading', label: '14. Transport Information' },
            { key: 'transport_class', label: 'UN Number, Class Category & Packing Group', type: 'text', width: 'w-full' }
        ]
    },
    'TAX_CHALLAN': {
        id: 'TAX_CHALLAN',
        title: 'Tax Invoice cum Delivery Challan',
        desc: 'GST compliant domestic invoice for inter-state supply of goods with delivery challan format.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'document_title', label: 'Document Title', type: 'text', value: 'Tax Invoice cum Delivery Challan', width: 'w-full', placeholder: 'Edit document name as needed' },
            { type: 'heading', label: 'Supplier Details' },
            { key: 'supplier_name', label: 'Supplier Name', type: 'text', required: true, width: 'w-full' },
            { key: 'supplier_address_line1', label: 'Address Line 1', type: 'text', required: true, width: 'w-full' },
            { key: 'supplier_address_line2', label: 'Address Line 2', type: 'text', width: 'w-full' },
            { key: 'supplier_city', label: 'City', type: 'text', required: true, width: 'w-1/3', api_populate: true },
            { key: 'supplier_state', label: 'State', type: 'text', required: true, width: 'w-1/3', api_populate: true },
            { key: 'supplier_pincode', label: 'Pincode', type: 'text', required: true, width: 'w-1/3', api_trigger: true, pattern: '[0-9]{6}' },
            { key: 'supplier_country', label: 'Country', type: 'text', value: 'INDIA', width: 'w-1/2', api_populate: true },
            { key: 'supplier_gstin', label: 'Supplier GSTIN', type: 'text', required: true, width: 'w-1/2' },
            { key: 'supplier_state_code', label: 'State Code', type: 'text', width: 'w-1/4', api_populate: true },
            { key: 'supplier_gst_code', label: 'GST State Code (01-37)', type: 'text', width: 'w-1/4' },
            { type: 'heading', label: 'Invoice Details' },
            { key: 'challan_no', label: 'Challan Number', type: 'text', required: true, width: 'w-1/2' },
            { key: 'challan_date', label: 'Challan Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'po_number', label: 'PO Number', type: 'text', width: 'w-1/2' },
            { key: 'po_date', label: 'PO Date', type: 'date', width: 'w-1/2' },
            { key: 'eway_bill', label: 'E-Way Bill Number', type: 'text', width: 'w-1/2' },
            { key: 'eway_valid', label: 'E-Way Bill Valid Upto', type: 'date', width: 'w-1/2' },
            { type: 'heading', label: 'Receiver Details' },
            { key: 'receiver_name', label: 'Receiver Name', type: 'text', required: true, width: 'w-full' },
            { key: 'receiver_address_line1', label: 'Address Line 1', type: 'text', required: true, width: 'w-full' },
            { key: 'receiver_address_line2', label: 'Address Line 2', type: 'text', width: 'w-full' },
            { key: 'receiver_city', label: 'City', type: 'text', required: true, width: 'w-1/3', api_populate: true },
            { key: 'receiver_state', label: 'State', type: 'text', required: true, width: 'w-1/3', api_populate: true },
            { key: 'receiver_pincode', label: 'Pincode', type: 'text', required: true, width: 'w-1/3', api_trigger: true, pattern: '[0-9]{6}' },
            { key: 'receiver_country', label: 'Country', type: 'text', value: 'INDIA', width: 'w-1/2', api_populate: true },
            { key: 'receiver_gstin', label: 'Receiver GSTIN', type: 'text', width: 'w-1/2' },
            { key: 'receiver_state_code', label: 'State Code', type: 'text', width: 'w-1/4', api_populate: true },
            { key: 'receiver_gst_code', label: 'GST State Code (01-37)', type: 'text', width: 'w-1/4' },
            { type: 'heading', label: 'Transport Details' },
            { key: 'transport_mode', label: 'Mode of Transport', type: 'select', options: ['ROAD', 'RAIL', 'AIR', 'SHIP'], width: 'w-1/3' },
            { key: 'vehicle_no', label: 'Vehicle Number', type: 'text', width: 'w-1/3' },
            { key: 'transporter', label: 'Transporter Name', type: 'text', width: 'w-1/3' },
            { key: 'lr_no', label: 'LR Number', type: 'text', width: 'w-1/2' },
            { key: 'dispatch_date', label: 'Dispatch Date', type: 'date', width: 'w-1/2' },
            { type: 'heading', label: 'Goods Details' },
            { key: 'items', label: 'Product List', type: 'items_table', width: 'w-full' },
            { type: 'heading', label: 'Additional Information' },
            { key: 'supply_type', label: 'Supply Type', type: 'select', options: ['Inter-State', 'Intra-State'], value: 'Inter-State', width: 'w-1/2' },
            { key: 'reverse_charge', label: 'Reverse Charge Applicable', type: 'select', options: ['No', 'Yes'], value: 'No', width: 'w-1/2' },
            { key: 'declaration', label: 'Declaration', type: 'textarea', value: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct. Goods sold are meant for resale/manufacture.', width: 'w-full' }
        ]
    },

    'DELIVERY_CHALLAN': {
        id: 'DELIVERY_CHALLAN',
        title: 'Delivery Challan & Packaging List',
        desc: 'Document for goods dispatch and receipt with detailed packaging information.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'document_title', label: 'Document Title', type: 'text', value: 'Delivery Challan & Packaging List', width: 'w-full', placeholder: 'Edit document name as needed' },
            { key: 'challan_no', label: 'Challan No.', type: 'text', required: true, width: 'w-1/2' },
            { key: 'challan_date', label: 'Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'from_company', label: 'From (Company)', type: 'text', required: true, width: 'w-1/2' },
            { key: 'to_company', label: 'To (Company)', type: 'text', required: true, width: 'w-1/2' },
            { key: 'from_address', label: 'From Address', type: 'textarea', required: true, width: 'w-1/2' },
            { key: 'to_address', label: 'To Address', type: 'textarea', required: true, width: 'w-1/2' },
            { key: 'delivery_date', label: 'Delivery Date', type: 'date', width: 'w-1/3' },
            { key: 'vehicle_no', label: 'Vehicle No.', type: 'text', width: 'w-1/3' },
            { key: 'driver_name', label: 'Driver Name', type: 'text', width: 'w-1/3' },
            { key: 'items', label: 'Product List', type: 'items_table', width: 'w-full' },
            { key: 'packages', label: 'Packaging Items', type: 'packing_table', width: 'w-full' },
            { key: 'special_instructions', label: 'Special Instructions', type: 'textarea', width: 'w-1/2' },
            { key: 'packaging_notes', label: 'Packaging Notes', type: 'textarea', width: 'w-1/2' }
        ]
    },
    'LOA': {
        id: 'LOA',
        title: 'Letter of Authority',
        desc: 'Legally authorizes a Customs House Agent (CHA) to act on behalf of the exporter/importer for customs clearance.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { type: 'heading', label: 'Exporter Details' },
            { key: 'exporter_name', label: 'Exporter Name', type: 'text', required: true, width: 'w-full' },
            { key: 'exporter_address', label: 'Exporter Address', type: 'textarea', required: true, width: 'w-full' },
            { key: 'iec_number', label: 'IEC Number', type: 'text', required: true, width: 'w-1/3' },
            { key: 'gstin', label: 'GSTIN', type: 'text', width: 'w-1/3' },
            { key: 'pan', label: 'PAN Number', type: 'text', width: 'w-1/3' },
            { type: 'heading', label: 'CHA Details' },
            { key: 'cha_name', label: 'CHA Name & Address', type: 'textarea', required: true, width: 'w-full' },
            { key: 'cha_license', label: 'CHA License Number', type: 'text', required: true, width: 'w-1/2' },
            { key: 'customs_authority', label: 'Customs Authority', type: 'text', value: 'The Commissioner of Customs', width: 'w-1/2' },
            { type: 'heading', label: 'Consignment Details' },
            { key: 'shipping_bill_no', label: 'Shipping Bill Number', type: 'text', width: 'w-1/2' },
            { key: 'invoice_no', label: 'Invoice Number', type: 'text', width: 'w-1/2' },
            { key: 'invoice_date', label: 'Invoice Date', type: 'date', width: 'w-1/3' },
            { key: 'vessel_flight', label: 'Vessel/Flight Number', type: 'text', width: 'w-1/3' },
            { key: 'port_loading', label: 'Port of Loading', type: 'text', width: 'w-1/3' },
            { type: 'heading', label: 'Authorization Period' },
            { key: 'valid_from', label: 'Valid From', type: 'date', required: true, width: 'w-1/2' },
            { key: 'valid_to', label: 'Valid To', type: 'date', required: true, width: 'w-1/2' },
            { type: 'heading', label: 'Signatory Details' },
            { key: 'signatory_name', label: 'Authorized Signatory Name', type: 'text', required: true, width: 'w-1/2' },
            { key: 'signatory_designation', label: 'Designation', type: 'text', required: true, width: 'w-1/2' }
        ]
    },
    'COO': {
        id: 'COO',
        title: 'Certificate of Origin',
        desc: 'Certifies the country where the goods were manufactured for customs duty determination and trade agreement benefits.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { type: 'heading', label: '1. Exporter Details' },
            { key: 'exporter_name', label: 'Exporter Business Name', type: 'text', required: true, width: 'w-full' },
            { key: 'exporter_address', label: 'Exporter Address', type: 'textarea', required: true, width: 'w-full' },
            { key: 'country_origin', label: 'Country of Origin', type: 'text', value: 'INDIA', required: true, width: 'w-1/2' },
            { type: 'heading', label: '2. Consignee Details' },
            { key: 'consignee_name', label: 'Consignee Name', type: 'text', required: true, width: 'w-full' },
            { key: 'consignee_address', label: 'Consignee Address', type: 'textarea', required: true, width: 'w-full' },
            { key: 'country_destination', label: 'Country of Destination', type: 'text', required: true, width: 'w-1/2' },
            { type: 'heading', label: '3. Transport Details' },
            { key: 'departure_date', label: 'Departure Date', type: 'date', required: true, width: 'w-1/3' },
            { key: 'vessel_aircraft', label: 'Vessel/Aircraft Name', type: 'text', width: 'w-1/3' },
            { key: 'transport_mode', label: 'Mode of Transport', type: 'select', options: ['AIR', 'SEA', 'ROAD', 'RAIL'], width: 'w-1/3' },
            { key: 'port_loading', label: 'Port of Loading', type: 'text', width: 'w-1/2' },
            { key: 'port_discharge', label: 'Port of Discharge', type: 'text', width: 'w-1/2' },
            { type: 'heading', label: '5-10. Goods Details' },
            { key: 'marks_numbers', label: 'Marks and Numbers on Packages', type: 'textarea', width: 'w-1/2' },
            { key: 'description_goods', label: 'Description of Goods', type: 'textarea', required: true, width: 'w-1/2' },
            { key: 'origin_criterion', label: 'Origin Criterion', type: 'select', options: ['P - Wholly Produced', 'W - Wholly Obtained', 'PE - Product Specific Rule'], value: 'P', width: 'w-1/3' },
            { key: 'gross_weight', label: 'Gross Weight (KGS)', type: 'number', width: 'w-1/3' },
            { key: 'number_packages', label: 'Number of Packages', type: 'number', width: 'w-1/3' },
            { key: 'invoice_no', label: 'Invoice Number', type: 'text', required: true, width: 'w-1/2' },
            { key: 'invoice_date', label: 'Invoice Date', type: 'date', required: true, width: 'w-1/2' },
            { type: 'heading', label: '11-12. Certification & Declaration' },
            { key: 'certifying_authority', label: 'Certifying Authority', type: 'text', value: 'MUMBAI CHAMBER OF COMMERCE & INDUSTRY', width: 'w-full' },
            { key: 'certification_date', label: 'Certification Date', type: 'date', required: true, width: 'w-1/2' },
            { key: 'declaration_place', label: 'Place of Declaration', type: 'text', value: 'MUMBAI', width: 'w-1/2' }
        ]
    },
    'NON_DG': {
        id: 'NON_DG',
        title: 'Non-DG Declaration',
        desc: 'A mandatory declaration for air freight certifying that the shipment contains no dangerous goods (explosives, flammables, etc.) restricted by IATA regulations, ensuring flight safety.',
        fields: [
            { key: 'reference_id', label: 'Reference ID', type: 'text', width: 'w-full', placeholder: 'Enter ID or leave blank for auto-generation' },
            { key: 'awb_number', label: 'DHL/AWB Number', type: 'text', required: true, width: 'w-1/3' },
            { key: 'mawb_number', label: 'MAWB Number', type: 'text', width: 'w-1/3' },
            { key: 'airport_departure', label: 'Airport of Departure', type: 'text', required: true, width: 'w-1/3' },
            { key: 'airport_destination', label: 'Airport of Destination', type: 'text', required: true, width: 'w-1/3' },
            { key: 'items', label: 'Cargo Details', type: 'nondg_table', width: 'w-full' },
            { key: 'total_packages', label: 'Total Number of Packages', type: 'number', width: 'w-1/3' },
            { key: 'net_weight', label: 'Net Weight (KGS)', type: 'number', width: 'w-1/3' },
            { key: 'gross_weight', label: 'Gross Weight (KGS)', type: 'number', width: 'w-1/3' },
            { key: 'shipper_name', label: 'Shipper Name', type: 'text', required: true, width: 'w-full' },
            { key: 'shipper_address', label: 'Shipper Address', type: 'textarea', required: true, width: 'w-full' },
            { key: 'signatory_name', label: 'Signatory Full Name', type: 'text', required: true, width: 'w-1/2' },
            { key: 'signatory_designation', label: 'Signatory Designation', type: 'text', required: true, width: 'w-1/2' }
        ]
    },
    // ... Add other schemas as needed ...
};

// ============================================================================
// SECTION 1.5: DECISION GUIDE
// ============================================================================
const DECISION_GUIDE = [
    {
        condition: "A standard commercial export",
        documents: [
            { id: 'COM_INV', name: 'Commercial-Invoice' },
            { id: 'PKL', name: 'Packing-List' },
            { id: 'KYC', name: 'KYC Form' },
            { id: 'SLI', name: 'Shippers-Letter-of-Instructions' },
            { id: 'BL_AWB', name: 'Bill of Lading/Air Waybill' },
            { id: 'SDF', name: 'SDF-Form' },
            { id: 'INS_CERT', name: 'Insurance Certificate' },
            { id: 'LOA', name: 'Letter of Authority' },
            { id: 'COO', name: 'Certificate of Origin' },
            { id: 'NON_DG', name: 'Non-DG-Declaration' }
        ]
    },
    {
        condition: "Domestic shipments within India",
        documents: [
            { id: 'TAX_CHALLAN', name: 'Tax Invoice cum Delivery Challan' },
            { id: 'DELIVERY_CHALLAN', name: 'Delivery Challan & Packaging List' }
        ]
    },
    {
        condition: "Claiming Duty Drawback",
        documents: [
            { id: 'APP_3', name: 'Appendix-III-for-Drawback' },
            { id: 'APP_4', name: 'Appendix-IV-for-Drawback' },
            { id: 'ANN_1', name: 'Annexure-I (Garments)' },
            { id: 'ANN_2', name: 'Annexure-II (Garments)' }
        ]
    },
    {
        condition: "Under DEPB/DEEC/EOU/Excise scheme",
        documents: [
            { id: 'ANN_D', name: 'Annexure-D (DEPB)' },
            { id: 'APP_2', name: 'Appendix-II (DEEC)' },
            { id: 'ANN_C1', name: 'Annexure-C1 (EOU)' },
            { id: 'ARE1', name: 'ARE-1 Form (Excise)' }
        ]
    },
    {
        condition: "Free Samples or Repair & Return",
        documents: [
            { id: 'GR_SAMPLE', name: 'GR-Waiver (Sample)' },
            { id: 'GR_REPAIR', name: 'GR-Waiver (Repair)' }
        ]
    },
    {
        condition: "Chemicals to the USA",
        documents: [
            { id: 'MSDS', name: 'MSDS' },
            { id: 'TSCA', name: 'TSCA-Certificate' }
        ]
    },
    {
        condition: "Textiles/Silk to the USA",
        documents: [
            { id: 'NEG_DEC', name: 'Negative-Declaration' },
            { id: 'QUOTA', name: 'Quota-Charge-Statement' },
            { id: 'SCD', name: 'Single-Country-Declaration' },
            { id: 'MCD', name: 'Multiple-Country-Declaration' }
        ]
    }
];

// ============================================================================
// SECTION 2: CORE LOGIC
// ============================================================================

