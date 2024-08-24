//import { parse } from "csv-parse/sync";
import { Contact } from "~/models/contacts";

/* export const parser = (text: string): string[][] => {
  try {
    return parse(text) as string[][];
  } catch (error) {
    console.error("Error parsing CSV:", error);
    throw new Error("Failed to parse CSV file. Please check the file format and try again.");
  }
}; */

export const parseCSVHeaders = (unparsedHeaders: string[]): string[] => {
  return unparsedHeaders.map((header) => header.toLowerCase().trim());
};

type CSVContact = Omit<Contact, "id" | "created_at" | "updated_at" | "created_by" | "updated_by" | "voted">;

export const parseCSVData = (data: string[][], parsedHeaders: string[]): Partial<CSVContact>[] => {
  return data.slice(1).map((row) => {
    const contact: Partial<CSVContact> = {
      other_data: {},
    };

    for (let i = 0; i < row.length; i++) {
      const key = parsedHeaders[i];
      const value = row[i]?.trim() ?? "";

      switch (true) {
        case /^(contact[-_\s]?)?(first[-_\s]?name|given[-_\s]?name|forename)$/i.test(key):
          contact.firstname = value;
          break;
        case /^(contact[-_\s]?)?(last[-_\s]?name|surname|family[-_\s]?name)$/i.test(key):
          contact.surname = value;
          break;
        case /^(contact[-_\s]?)?(phone|phone[-_\s]?number|mobile|mobile[-_\s]?number|cell|cell[-_\s]?phone)$/i.test(key):
          contact.phone = value;
          break;
        case /^(contact[-_\s]?)?(email|email[-_\s]?address|e-mail|e-mail[-_\s]?address)$/i.test(key):
          contact.email = value;
          break;
        case /^(contact[-_\s]?)?(address|street|street[-_\s]?address|mailing[-_\s]?address|property[-_\s]?address|address[-_\s]?line[-_\s]?1)$/i.test(key):
          contact.address = value;
          break;
        case /^(contact[-_\s]?)?(unit|apartment|suite|apt)$/i.test(key):
          contact.unit = value;
          break;
        case /^(contact[-_\s]?)?(street[-_\s]?name)$/i.test(key):
          contact.street_name = value;
          break;
        case /^(contact[-_\s]?)?(street[-_\s]?number)$/i.test(key):
          contact.street_number = value;
          break;
        case /^(contact[-_\s]?)?(city|town)$/i.test(key):
          contact.city = value;
          break;
        case /^(contact[-_\s]?)?(external[-_]?id|vanid|van[-_]?id|id|record[-_\s]?id)$/i.test(key):
          contact.external_id = value;
          break;
        case /^(contact[-_\s]?)?(postal|postal[-_]?code|zip|zip[-_]?code)$/i.test(key):
          contact.postal = value;
          break;
        case /^(contact[-_\s]?)?(name)$/i.test(key):
          const names = value.split(",").map((name) => name.trim());
          contact.surname = names[0];
          contact.firstname = names[1];
          break;
        case /^(contact[-_\s]?)?(province|state)$/i.test(key):
          // Assuming you want to store province/state in the other_data object
          contact.other_data["province"] = value;
          break;
        case /^(contact[-_\s]?)?(country)$/i.test(key):
          // Assuming you want to store country in the other_data object
          contact.other_data["country"] = value;
          break;
        case /^(contact[-_\s]?)?(electoral[-_\s]?district)$/i.test(key):
          contact.electoral_district = value;
          break;
        case /^(contact[-_\s]?)?(poll[-_\s]?id)$/i.test(key):
          contact.poll_id = value;
          break;
        default:
          // Store any unmatched fields in the other_data object
          contact.other_data[key] = value;
      }
    }

    // Remove the other_data property if it's empty
    if (Object.keys(contact.other_data).length === 0) {
      delete contact.other_data;
    }

    return contact;
  });
};

export function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentValue += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentValue += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',' || char === '\n' || char === '\r') {
        row.push(currentValue.trim());
        currentValue = '';
        if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          result.push(row);
          row = [];
          if (char === '\r') i++;
        }
      } else {
        currentValue += char;
      }
    }
  }

  if (currentValue) {
    row.push(currentValue.trim());
  }
  if (row.length > 0) {
    result.push(row);
  }

  return result;
}
