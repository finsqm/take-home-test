function splitName(name: string): { firstName: string; lastName: string } {
	const [firstName, ...rest] = name.trim().split(/\s+/);
	return { firstName, lastName: rest.join(" ") };
}

function mapGender(gender: IngestedFormSchema["gender"]): TransformedFormSchema["gender"] {
	return gender === "other" ? "prefer-not-to-say" : gender;
}

export function transformForm(form: IngestedFormSchema, geo: { longitude: number; latitude: number }): TransformedFormSchema {
	const { firstName, lastName } = splitName(form.name);

	return {
		sessionId: form.session_id,
		applicationReference: form.application_reference,
		firstName,
		lastName,
		email: form.email,
		gender: mapGender(form.gender),
		dateOfBirth: new Date(form.date_of_birth),
		phoneNumber: form.phone_number,
		mobileNumber: form.mobile_number,
		addressLine1: form.address.address_line_1,
		addressLine2: form.address.address_line_2,
		addressLine3: form.address.address_line_3,
		postcode: form.address.postcode,
		country: form.address.country,
		longitude: geo.longitude,
		latitude: geo.latitude,
	};
}
