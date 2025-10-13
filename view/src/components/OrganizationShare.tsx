import React, {useState, forwardRef, useEffect, useImperativeHandle, ForwardRefRenderFunction,} from 'react';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

interface workspaceState {
    id: string; 
    slug: string; 
    [key: string]: any
}

interface invoiceState {
  name: string;
  email: string;
  ship_address: string;
  ship_postcode: string;
  ship_city: string;
  ship_state: string;
  ship_country: string;
  items: any[];
}

interface DataState {
  sharingShow: boolean;
  workspace: workspaceState | any;
  invoice: invoiceState | any;
}

export interface OpenShareWindowHandle {
  enableShare: () => void;
}

interface OrganizationShareProps {
  workspace: workspaceState | null;
}

const OrganizationShareInner: ForwardRefRenderFunction<OpenShareWindowHandle, OrganizationShareProps> = ( {workspace}, ref ) => {
    const [copySuccess, setCopySuccess] = useState<boolean>(false);

    const [data, setData] = useState<DataState>({
        sharingShow: false,
        workspace: workspace || { id: '', slug: '', title: '', metas: { stripe_currency: 'usd'} },
        invoice: {name:"", email:"", ship_address:"", ship_postcode:"", ship_city:"", ship_state:"", ship_country:"US", items:[]}
    });

    useEffect(() => {
        setData((prevData) => ({ ...prevData, workspace: workspace }));
    }, [workspace]);

    useImperativeHandle(ref, () => ({
        enableShare: () => {
            setData((prevData) => ({ ...prevData, sharingShow: true }));
        }
    }));

    const copyWorkspace = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            setCopySuccess(false);
        }
    };

    const closeSharing = async(): Promise<void> => {
        setData((prevData) => ({ ...prevData, sharingShow: false }));
    };

    useEffect(() => {
        console.log( data.workspace );
    }, [data] );
    
    return (
        <Modal size="lg" show={data.sharingShow} onHide={closeSharing}>
            <Modal.Header>
                <Modal.Title>Tailor your AI-ready invoice</Modal.Title>
                <button className="btn-close" onClick={closeSharing}></button>
            </Modal.Header>
            <Modal.Body>
                <p>Copy the unique URL below and share it directly with your customer.</p>
                <div className="input-group mb-3">
                    <input type="text" className="form-control" value={App.base + '/' + ( data.workspace != null ? data.workspace.slug : '' ) + "/?name=" + encodeURIComponent( data.invoice.name ) + "&email=" + encodeURIComponent( data.invoice.email ) + "&ship_address=" + encodeURIComponent( data.invoice.ship_address ) + "&ship_city=" + encodeURIComponent( data.invoice.ship_city ) + "&ship_postcode=" + encodeURIComponent( data.invoice.ship_postcode ) + "&ship_country=" + encodeURIComponent( data.invoice.ship_country ) + "&" + data.invoice.items.map( (item: { title: string; price: number; units: number }, i: number ) => `item${i + 1}_name=${encodeURIComponent(item.title)}&item${i + 1}_price=${item.price}&item${i + 1}_units=${item.units}`).join("&") } readOnly />
                    <button className="btn btn-outline-secondary" type="button" id="copy_button" onClick={() => copyWorkspace( App.base + '/' + ( data.workspace != null ? data.workspace.slug : '' ) + "/?name=" + encodeURIComponent( data.invoice.name ) + "&email=" + encodeURIComponent( data.invoice.email ) + "&ship_address=" + encodeURIComponent( data.invoice.ship_address ) + "&ship_city=" + encodeURIComponent( data.invoice.ship_city ) + "&ship_postcode=" + encodeURIComponent( data.invoice.ship_postcode ) + "&ship_country=" + encodeURIComponent( data.invoice.ship_country ) + "&" + data.invoice.items.map( (item: { title: string; price: number; units: number }, i: number ) => `item${i + 1}_name=${encodeURIComponent(item.title)}&item${i + 1}_price=${item.price}&item${i + 1}_units=${item.units}`).join("&") )} style={{ pointerEvents: ( copySuccess ? "none" : "auto" ), color: ( copySuccess ? "gray" : "" )}}>{ !copySuccess ? 'Copy' : 'Copied' }</button>
                </div>
                <div className="row">
                    <div className="col-12 col-md-8">
                        <h5>Items</h5>
                        <form>
                            <div className="row mb-3">
                                <div className="col">
                                    <label htmlFor="title" className="form-label">Title</label>
                                </div>
                                <div className="col">
                                    <label htmlFor="price" className="form-label">Price ({data.workspace.metas.stripe_currency})</label>
                                </div>
                                <div className="col">
                                    <label htmlFor="units" className="form-label">Units</label>
                                </div>
                            </div>
                            {Array.from({ length: data.invoice.items.length + 1 }, (_, index) => (
                                <div className="row mb-3" key={index}>
                                    <div className="col">
                                        <input
                                            type="text"
                                            className="form-control"
                                            id={`title${index}`}
                                            placeholder="Title"
                                            value={data.invoice.items[index]?.title || ""}
                                            onChange={(e) =>
                                                setData((prevData) => {
                                                    const newItems = [...prevData.invoice.items];
                                                    newItems[index] = { ...newItems[index], title: e.target.value };
                                                    return {
                                                        ...prevData,
                                                        invoice: { ...prevData.invoice, items: newItems },
                                                    };
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="col">
                                        <input
                                            type="number"
                                            step="any"
                                            min="0"
                                            className="form-control"
                                            id={`price${index}`}
                                            placeholder="Price"
                                            value={data.invoice.items[index]?.price || ""}
                                            onKeyDown={(e) => {
                                                // ✅ Allow: digits, one dot, backspace, delete, arrows, tab
                                                const allowedKeys = [
                                                    "Backspace",
                                                    "Delete",
                                                    "ArrowLeft",
                                                    "ArrowRight",
                                                    "Tab",
                                                ];
                                                const isNumber = /^[0-9.]$/.test(e.key);
                                                if (!isNumber && !allowedKeys.includes(e.key)) {
                                                    e.preventDefault();
                                                }

                                                // ✅ Prevent typing more than one dot
                                                if (e.key === "." && e.currentTarget.value.includes(".")) {
                                                    e.preventDefault();
                                                }
                                            }}
                                            onChange={(e) => {
                                                const value = e.target.value;

                                                // ✅ Allow only: digits, one optional dot, and nothing else
                                                if (/^\d*\.?\d*$/.test(value)) {
                                                    setData((prevData) => {
                                                        const newItems = [...prevData.invoice.items];
                                                        newItems[index] = { ...newItems[index], price: value };
                                                        return {
                                                            ...prevData,
                                                            invoice: { ...prevData.invoice, items: newItems },
                                                        };
                                                    });
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="col">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id={`units${index}`}
                                            placeholder="Units"
                                            value={data.invoice.items[index]?.units || ""}
                                            onKeyDown={(e) => {
                                                const allowedKeys = [
                                                    "Backspace",
                                                    "Delete",
                                                    "ArrowLeft",
                                                    "ArrowRight",
                                                    "Tab",
                                                ];
                                                const isNumber = /^[0-9]$/.test(e.key);
                                                if (!isNumber && !allowedKeys.includes(e.key)) {
                                                    e.preventDefault();
                                                }
                                            }}
                                            onChange={(e) =>
                                                setData((prevData) => {
                                                    const newItems = [...prevData.invoice.items];
                                                    newItems[index] = { ...newItems[index], units: e.target.value };
                                                    return {
                                                        ...prevData,
                                                        invoice: { ...prevData.invoice, items: newItems },
                                                    };
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                            ))}
                        </form>
                    </div>
                    <div className="col-12 col-md-4">
                        <h5>Shipping details</h5>
                        <form>
                            <div className="mb-3">
                                <label htmlFor="email" className="form-label">Name</label>
                                <input 
                                    type="email" className="form-control" id="name" placeholder="John Doe" onChange={(e) => setData(prevData => ({ ...prevData, invoice: { ...prevData.invoice, name: e.target.value }}))} />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="email" className="form-label">Email</label>
                                <input 
                                    type="email" className="form-control" id="email" placeholder="name@example.com" onChange={(e) => setData(prevData => ({ ...prevData, invoice: { ...prevData.invoice, email: e.target.value }}))} />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="address" className="form-label">Address</label>
                                <input type="text" className="form-control" id="address" placeholder="123 Main St" onChange={(e) => setData(prevData => ({ ...prevData, invoice: { ...prevData.invoice, ship_address: e.target.value }}))} />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="postcode" className="form-label">Postcode</label>
                                <input type="text" className="form-control" id="postcode" placeholder="12345" onChange={(e) => setData(prevData => ({ ...prevData, invoice: { ...prevData.invoice, ship_postcode: e.target.value }}))} />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="city" className="form-label">City</label>
                                <input type="text" className="form-control" id="city" placeholder="New York" onChange={(e) => setData(prevData => ({ ...prevData, invoice: { ...prevData.invoice, ship_city: e.target.value }}))} />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="state" className="form-label">State</label>
                                <input type="text" className="form-control" id="state" placeholder="NY" onChange={(e) => setData(prevData => ({ ...prevData, invoice: { ...prevData.invoice, ship_state: e.target.value }}))} />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="country" className="form-label">Country</label>
                                <select className="form-select" id="country" onChange={(e) => setData(prevData => ({ ...prevData, invoice: { ...prevData.invoice, ship_country: e.target.value }}))}>
                                    <option value="AF">Afghanistan</option>
                                    <option value="AL">Albania</option>
                                    <option value="DZ">Algeria</option>
                                    <option value="AD">Andorra</option>
                                    <option value="AO">Angola</option>
                                    <option value="AG">Antigua and Barbuda</option>
                                    <option value="AR">Argentina</option>
                                    <option value="AM">Armenia</option>
                                    <option value="AU">Australia</option>
                                    <option value="AT">Austria</option>
                                    <option value="AZ">Azerbaijan</option>
                                    <option value="BS">Bahamas</option>
                                    <option value="BH">Bahrain</option>
                                    <option value="BD">Bangladesh</option>
                                    <option value="BB">Barbados</option>
                                    <option value="BY">Belarus</option>
                                    <option value="BE">Belgium</option>
                                    <option value="BZ">Belize</option>
                                    <option value="BJ">Benin</option>
                                    <option value="BT">Bhutan</option>
                                    <option value="BO">Bolivia</option>
                                    <option value="BA">Bosnia and Herzegovina</option>
                                    <option value="BW">Botswana</option>
                                    <option value="BR">Brazil</option>
                                    <option value="BN">Brunei</option>
                                    <option value="BG">Bulgaria</option>
                                    <option value="BF">Burkina Faso</option>
                                    <option value="BI">Burundi</option>
                                    <option value="CV">Cabo Verde</option>
                                    <option value="KH">Cambodia</option>
                                    <option value="CM">Cameroon</option>
                                    <option value="CA">Canada</option>
                                    <option value="CF">Central African Republic</option>
                                    <option value="TD">Chad</option>
                                    <option value="CL">Chile</option>
                                    <option value="CN">China</option>
                                    <option value="CO">Colombia</option>
                                    <option value="KM">Comoros</option>
                                    <option value="CG">Congo</option>
                                    <option value="CR">Costa Rica</option>
                                    <option value="CI">Côte d'Ivoire</option>
                                    <option value="HR">Croatia</option>
                                    <option value="CU">Cuba</option>
                                    <option value="CY">Cyprus</option>
                                    <option value="CZ">Czechia</option>
                                    <option value="DK">Denmark</option>
                                    <option value="DJ">Djibouti</option>
                                    <option value="DM">Dominica</option>
                                    <option value="DO">Dominican Republic</option>
                                    <option value="EC">Ecuador</option>
                                    <option value="EG">Egypt</option>
                                    <option value="SV">El Salvador</option>
                                    <option value="GQ">Equatorial Guinea</option>
                                    <option value="ER">Eritrea</option>
                                    <option value="EE">Estonia</option>
                                    <option value="SZ">Eswatini</option>
                                    <option value="ET">Ethiopia</option>
                                    <option value="FJ">Fiji</option>
                                    <option value="FI">Finland</option>
                                    <option value="FR">France</option>
                                    <option value="GA">Gabon</option>
                                    <option value="GM">Gambia</option>
                                    <option value="GE">Georgia</option>
                                    <option value="DE">Germany</option>
                                    <option value="GH">Ghana</option>
                                    <option value="GR">Greece</option>
                                    <option value="GD">Grenada</option>
                                    <option value="GT">Guatemala</option>
                                    <option value="GN">Guinea</option>
                                    <option value="GW">Guinea-Bissau</option>
                                    <option value="GY">Guyana</option>
                                    <option value="HT">Haiti</option>
                                    <option value="HN">Honduras</option>
                                    <option value="HU">Hungary</option>
                                    <option value="IS">Iceland</option>
                                    <option value="IN">India</option>
                                    <option value="ID">Indonesia</option>
                                    <option value="IR">Iran</option>
                                    <option value="IQ">Iraq</option>
                                    <option value="IE">Ireland</option>
                                    <option value="IL">Israel</option>
                                    <option value="IT">Italy</option>
                                    <option value="JM">Jamaica</option>
                                    <option value="JP">Japan</option>
                                    <option value="JO">Jordan</option>
                                    <option value="KZ">Kazakhstan</option>
                                    <option value="KE">Kenya</option>
                                    <option value="KI">Kiribati</option>
                                    <option value="KP">North Korea</option>
                                    <option value="KR">South Korea</option>
                                    <option value="KW">Kuwait</option>
                                    <option value="KG">Kyrgyzstan</option>
                                    <option value="LA">Laos</option>
                                    <option value="LV">Latvia</option>
                                    <option value="LB">Lebanon</option>
                                    <option value="LS">Lesotho</option>
                                    <option value="LR">Liberia</option>
                                    <option value="LY">Libya</option>
                                    <option value="LI">Liechtenstein</option>
                                    <option value="LT">Lithuania</option>
                                    <option value="LU">Luxembourg</option>
                                    <option value="MG">Madagascar</option>
                                    <option value="MW">Malawi</option>
                                    <option value="MY">Malaysia</option>
                                    <option value="MV">Maldives</option>
                                    <option value="ML">Mali</option>
                                    <option value="MT">Malta</option>
                                    <option value="MH">Marshall Islands</option>
                                    <option value="MR">Mauritania</option>
                                    <option value="MU">Mauritius</option>
                                    <option value="MX">Mexico</option>
                                    <option value="FM">Micronesia</option>
                                    <option value="MD">Moldova</option>
                                    <option value="MC">Monaco</option>
                                    <option value="MN">Mongolia</option>
                                    <option value="ME">Montenegro</option>
                                    <option value="MA">Morocco</option>
                                    <option value="MZ">Mozambique</option>
                                    <option value="MM">Myanmar</option>
                                    <option value="NA">Namibia</option>
                                    <option value="NR">Nauru</option>
                                    <option value="NP">Nepal</option>
                                    <option value="NL">Netherlands</option>
                                    <option value="NZ">New Zealand</option>
                                    <option value="NI">Nicaragua</option>
                                    <option value="NE">Niger</option>
                                    <option value="NG">Nigeria</option>
                                    <option value="MK">North Macedonia</option>
                                    <option value="NO">Norway</option>
                                    <option value="OM">Oman</option>
                                    <option value="PK">Pakistan</option>
                                    <option value="PW">Palau</option>
                                    <option value="PA">Panama</option>
                                    <option value="PG">Papua New Guinea</option>
                                    <option value="PY">Paraguay</option>
                                    <option value="PE">Peru</option>
                                    <option value="PH">Philippines</option>
                                    <option value="PL">Poland</option>
                                    <option value="PT">Portugal</option>
                                    <option value="QA">Qatar</option>
                                    <option value="RO">Romania</option>
                                    <option value="RU">Russia</option>
                                    <option value="RW">Rwanda</option>
                                    <option value="KN">Saint Kitts and Nevis</option>
                                    <option value="LC">Saint Lucia</option>
                                    <option value="VC">Saint Vincent and the Grenadines</option>
                                    <option value="WS">Samoa</option>
                                    <option value="SM">San Marino</option>
                                    <option value="ST">Sao Tome and Principe</option>
                                    <option value="SA">Saudi Arabia</option>
                                    <option value="SN">Senegal</option>
                                    <option value="RS">Serbia</option>
                                    <option value="SC">Seychelles</option>
                                    <option value="SL">Sierra Leone</option>
                                    <option value="SG">Singapore</option>
                                    <option value="SK">Slovakia</option>
                                    <option value="SI">Slovenia</option>
                                    <option value="SB">Solomon Islands</option>
                                    <option value="SO">Somalia</option>
                                    <option value="ZA">South Africa</option>
                                    <option value="ES">Spain</option>
                                    <option value="LK">Sri Lanka</option>
                                    <option value="SD">Sudan</option>
                                    <option value="SR">Suriname</option>
                                    <option value="SE">Sweden</option>
                                    <option value="CH">Switzerland</option>
                                    <option value="SY">Syria</option>
                                    <option value="TW">Taiwan</option>
                                    <option value="TJ">Tajikistan</option>
                                    <option value="TZ">Tanzania</option>
                                    <option value="TH">Thailand</option>
                                    <option value="TL">Timor-Leste</option>
                                    <option value="TG">Togo</option>
                                    <option value="TO">Tonga</option>
                                    <option value="TT">Trinidad and Tobago</option>
                                    <option value="TN">Tunisia</option>
                                    <option value="TR">Turkey</option>
                                    <option value="TM">Turkmenistan</option>
                                    <option value="TV">Tuvalu</option>
                                    <option value="UG">Uganda</option>
                                    <option value="UA">Ukraine</option>
                                    <option value="AE">United Arab Emirates</option>
                                    <option value="GB">United Kingdom</option>
                                    <option value="US" selected>United States</option>
                                    <option value="UY">Uruguay</option>
                                    <option value="UZ">Uzbekistan</option>
                                    <option value="VU">Vanuatu</option>
                                    <option value="VA">Vatican City</option>
                                    <option value="VE">Venezuela</option>
                                    <option value="VN">Vietnam</option>
                                    <option value="YE">Yemen</option>
                                    <option value="ZM">Zambia</option>
                                    <option value="ZW">Zimbabwe</option>
                                </select>
                            </div>
                        </form>
                    </div>
                </div>
                <div className="alert alert-info" role="alert">
                    Use following prompt in your favorite bot creator to generate invoices automatically.
                </div>
                <textarea
                    className="form-control"
                    rows={8}
                    readOnly
                    style={{ fontFamily: "monospace" }}
                    value={`You are a sales person, greet new customer and let the customer know about the available items by displaying list. Ask for what he likes to order. Here are the available products:\n${data.invoice.items.map( (item: { title: string; price: number; units: number }, i: number) => `- ${item.title}: ${item.price} ${data.workspace?.metas?.stripe_currency || "usd"} per unit` ).join("\n")} \nWhen you know the product items the customer would like to order, his name and email, say thanks and ask him to complete payment using a generated link as: ${App.base}/${data.workspace?.slug || ""}/?name={name}&email={email}` + ( data.invoice.ship_address ? `&ship_address={shipping_address}&ship_city={shipping_city}&ship_postcode={shipping_postcode}&ship_country={shipping_country}` : '' ) + `&item1_name={item1_name}&item1_price={item1_price}&item1_units={item1_units}&item2_name={item2_name}&item2_price={item2_price}&item2_units={item2_units}&...`}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    ></textarea>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={closeSharing}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    )
}

const OrganizationShare = forwardRef(OrganizationShareInner);
export default OrganizationShare;